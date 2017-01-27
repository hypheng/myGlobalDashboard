const co = require('co');
const RestClient = require('../client/restClient');
const dbClient = require('../client/dbClient');
const gdBaseClient = require('../client/gdBaseClient');
const applianceClient = require('../client/applianceClient');
const resourceService = require('./resourceService');
const CONST = require('../const');

const APPLIANCE_STATE = {
  Adding: 'Adding',
  Online: 'Online',
  Deleting: 'Deleting',
  Error: 'Error',
};

module.exports.APPLIANCE_STATE = APPLIANCE_STATE;

// Add resources from appliance and bring it online
function setApplianceOnline(context, appliance) {
  if (!appliance) {
    return;
  }

  context.log.info('set appliance online');
  resourceService.addResources(context, appliance)
    .then(() => {
      context.log.info(`succeed to add resources from appliance ${appliance.name}`);
      return dbClient.update({
        index: CONST.CATEGORY.APPLIANCES,
        type: CONST.CATEGORY.APPLIANCES,
        id: appliance.id,
        body: {
          doc: {
            state: APPLIANCE_STATE.Online,
          },
        },
      });
    }, (err) => {
      context.log.error(err, `fail to add resources from appliance ${appliance.name}`);
      return dbClient.update({
        index: CONST.CATEGORY.APPLIANCES,
        type: CONST.CATEGORY.APPLIANCES,
        id: appliance.id,
        body: {
          doc: {
            state: APPLIANCE_STATE.Error,
          },
        },
      });
    }).catch((err) => {
      context.log.error(err, `fail to update appliance ${appliance.name}`);
    });
}

module.exports.discoverApplianceInfo =
function discoverApplianceInfo(context, address, credential, ignoreCert) {
  return co(function* discoverApplianceInfoGen() {
    const ovClient = new RestClient(address, credential, ignoreCert);

    yield ovClient.login(context);

    // Get appliance supported API version first
    // X-API-Version is needed by the following REST call
    const applianceAPIVersion = yield ovClient.get(context, { uri: '/rest/version' });
    context.log.info({ version: applianceAPIVersion.currentVersion },
      'get appliance API version');
    ovClient.setHeader('X-API-Version', applianceAPIVersion.currentVersion);

    // Get appliance information
    const promises = [
      ovClient.get(context, { uri: '/rest/appliance/nodeinfo/version' }),
      ovClient.get(context, { uri: '/rest/appliance/nodeinfo/status' }),
      ovClient.get(context, { uri: '/rest/appliance/health-status' }),
      ovClient.get(context, { uri: '/rest/appliance/network-interfaces' }),
    ];

    const responses = yield Promise.all(promises);
    const applianceVersion = responses[0];
    const applianceStatus = responses[1];
    const applianceHealth = responses[2];
    const networkInterfaces = responses[3];

    const credentialId = yield gdBaseClient.saveCredential(credential);
    const appliance = {
      id: applianceVersion.serialNumber,
      category: CONST.CATEGORY.APPLIANCES,
      uri: `/rest/global/appliances/${applianceVersion.serialNumber}`,
      state: APPLIANCE_STATE.Adding,
      address,
      credentialId,
      username: credential.username,
      ignoreCert,
      'X-API-Version': applianceAPIVersion.currentVersion,
      nodeinfo: {
        version: applianceVersion,
        status: applianceStatus,
      },
      'health-status': applianceHealth.members,
      'network-interfaces': networkInterfaces,
    };

    applianceClient.cacheClient(context.log, appliance, ovClient);
    return appliance;
  });
};

module.exports.getDefaultApplianceName = function getDefaultApplianceName(context, appliance) {
  let applianceName;
  appliance['network-interfaces'].applianceNetworks.forEach((networkInterface) => {
    if (!applianceName) {
      applianceName = networkInterface.hostname.split('.').shift();
    }
  });

  if (!applianceName) {
    appliance['network-interfaces'].applianceNetworks.forEach((networkInterface) => {
      if (!applianceName) {
        applianceName = networkInterface.app1Ipv4Addr;
      }
    });
  }

  return applianceName;
};

module.exports.post = function post(req, res) {
  const context = {
    log: req.log.child({
      address: req.body.address,
    }),
  };

  co(function* postApplianceGen() {
    // login appliance
    const credential = {
      username: req.body.username,
      password: req.body.password,
      domain: req.body.domain,
    };

    const appliance = yield module.exports.discoverApplianceInfo(
      context, req.body.address, credential, req.body.ignoreCert);

    appliance.name = req.body.name || module.exports.getDefaultApplianceName(context, appliance);

    yield dbClient.createIndexIfNotExist(context, CONST.CATEGORY.APPLIANCES);

    // Verify if appliance is already added
    const exists = yield dbClient.exists({
      index: CONST.CATEGORY.APPLIANCES,
      type: CONST.CATEGORY.APPLIANCES,
      id: appliance.id,
    });
    if (exists) {
      context.log.warn('appliance already exist');
      res.status(400).end('appliance is already added');
      return null;
    }

    // Save appliance info into DB
    return yield dbClient.create({
      index: CONST.CATEGORY.APPLIANCES,
      type: CONST.CATEGORY.APPLIANCES,
      id: appliance.id,
      body: appliance,
    }).then(() => {
      context.log.info('appliance is saved');
      res.json(appliance);
      return appliance;
    }, (err) => {
      if (err.statusCode === 409) {
        context.log.warn({ appliance }, 'appliance is already added');
        res.status(409).send('appliance is already added');
        return null;
      }
      throw err;
    });
  }).then((appliance) => {
    context.log.info('POST appliance done');
    setApplianceOnline(context, appliance);
  }, (err) => {
    if (err.error && err.error.code === 'ETIMEDOUT' && err.error.connect) {
      context.log.warn({ err });
      res.status(400).send('appliance address cannot be connected');
    } else {
      context.log.error(err);
      res.status(500).send(err);
    }
  });
};

module.exports.get = function get(req, res) {
  res.status(204).end();
};
module.exports.getList = function getList(req, res) {
  res.status(204).end();
};
module.exports.delete = function deleteAppliance(req, res) {
  res.status(204).end();
};

module.exports.updateResourceCounts = function updateResourceCounts(context, appliance, counts) {
  return co(function* updateResourceCountsGen() {
    context.log.info(counts, `update appliance ${appliance.name} id ${appliance.id} counts`);
    yield dbClient.update({
      index: CONST.CATEGORY.APPLIANCES,
      type: CONST.CATEGORY.APPLIANCES,
      id: appliance.id,
      retry_on_conflict: Object.keys(CONST.GD_OV_CATEGORY_MAP).length,
      body: {
        doc: {
          counts,
        },
      },
    });
  });
};
