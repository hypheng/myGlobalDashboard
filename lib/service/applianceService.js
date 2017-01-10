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

function setApplianceOnline(context, appliance) {
  if (!appliance) {
    return;
  }

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
    }).then(() => {}, (err) => {
      context.log.error(err, `fail to update appliance ${appliance.name}`);
    });
}

module.exports.post = function post(req, res) {
  co(function* postApplianceGen() {
    // login appliance
    const credential = {
      username: req.body.username,
      password: req.body.password,
      domain: req.body.domain,
    };
    const ovClient = new RestClient(req.body.address, credential, req.body.ignoreCert);
    yield ovClient.login(req);

    // Get appliance supported API version
    const applianceAPIVersion = yield ovClient.get(req, { uri: '/rest/version' });
    req.log.info(`get appliance API version: ${applianceAPIVersion.currentVersion}`);
    ovClient.addHeader('X-API-Version', applianceAPIVersion.currentVersion);
    // Get appliance basic information
    const applianceVersion = yield ovClient.get(req, { uri: '/rest/appliance/nodeinfo/version' });
    req.log.info(`get appliance node version: ${applianceVersion.softwareVersion}`);

    // Verify if appliance is already added
    const existingApplianceList = yield dbClient.search({
      index: CONST.CATEGORY.APPLIANCES,
      q: `serialNumber:${applianceVersion.serialNumber}`,
    });
    if (existingApplianceList.hits.total > 0) {
      req.log.warn({ applianceVersion }, `appliance ${req.body.address} already exist`);
      res.status(400).end('appliance is already added');
      return null;
    }

    // Get appliance other information
    const applianceStatus = yield ovClient.get(req, { uri: '/rest/appliance/nodeinfo/status' });
    req.log.info('get appliance node status');

    const applianceHealth = yield ovClient.get(req, { uri: '/rest/appliance/health-status' });
    req.log.info(`get appliance health status ${applianceHealth.count} of ${applianceHealth.total}`);

    const networkInterfaces = yield ovClient.get(req, { uri: '/rest/appliance/network-interfaces' });
    req.log.info(`get appliance ${networkInterfaces.applianceNetworks.length} network interfaces`);

    let applianceName = req.body.applianceName;
    if (!applianceName) {
      networkInterfaces.applianceNetworks.forEach((networkInterface) => {
        if (!applianceName) {
          applianceName = networkInterface.hostname;
        }
      });
    }
    if (!applianceName) {
      networkInterfaces.applianceNetworks.forEach((networkInterface) => {
        if (!applianceName) {
          applianceName = networkInterface.app1Ipv4Addr;
        }
      });
    }

    const credentialId = yield gdBaseClient.saveCredential(credential);
    const appliance = Object.assign({},
      {
        id: applianceVersion.serialNumber,
        category: CONST.CATEGORY.APPLIANCES,
        name: applianceName,
        uri: `/rest/global/appliances/${applianceVersion.serialNumber}`,
        address: req.body.address,
        'X-API-Version': applianceAPIVersion.currentVersion,
        state: APPLIANCE_STATE.Adding,
        credentialId,
        ignoreCert: req.body.ignoreCert,
        nodeinfo: {
          version: applianceVersion,
          status: applianceStatus,
        },
        'health-status': applianceHealth.members,
        'network-interfaces': networkInterfaces,
      });

    applianceClient.cacheClient(appliance, ovClient);

    return yield dbClient.create({
      index: CONST.CATEGORY.APPLIANCES,
      type: CONST.CATEGORY.APPLIANCES,
      id: applianceVersion.serialNumber,
      body: appliance,
    })
    .then(() => {
      req.log.info(`appliance ${appliance.name} is saved`);
      res.json(appliance);
      return appliance;
    })
    .catch((err) => {
      if (err.statusCode === 409) {
        req.log.warn(`appliance ${appliance.name} with id ${appliance.id} is already added`);
        res.status(409).send('appliance already added');
        return null;
      }
      throw err;
    });
  }).then((appliance) => {
    setApplianceOnline(req, appliance);
  }, (err) => {
    req.log.error(err);
    res.status(500).send(err);
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

module.exports.updateResourceCounts = function updateResourceCounts(appliance, counts) {
  return co(function* updateResourceCountsGen() {
    const newAppliance = yield dbClient.get({
      index: CONST.CATEGORY.APPLIANCES,
      type: CONST.CATEGORY.APPLIANCES,
      id: appliance.id,
    });

    Object.keys(counts).forEach((category) => {
      newAppliance.counts[category] = counts[category];
    });

    yield dbClient.update({
      index: CONST.CATEGORY.APPLIANCES,
      type: CONST.CATEGORY.APPLIANCES,
      id: appliance.id,
      body: {
        doc: {
          counts: newAppliance.counts,
        },
      },
    });
  });
};
