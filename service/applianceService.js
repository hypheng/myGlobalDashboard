const co = require('co');
const RESTClient = require('../client/restClient');
const dbClient = require('../client/dbClient');
const resourceService = require('./resourceService');

function setApplianceOnline(context, appliance) {
  if (!appliance) {
    return;
  }

  resourceService.addResourcesFrom(appliance)
    .then(() => {
      context.log.info(`succeed to add resources from appliance ${appliance.name}`);
      return dbClient.update({
        index: 'appliances',
        type: 'appliances',
        id: appliance.id,
        body: {
          doc: {
            state: 'Online',
          },
        },
      });
    }, (err) => {
      context.log.error(err, `fail to add resources from appliance ${appliance.name}`);
      return dbClient.update({
        index: 'appliances',
        type: 'appliances',
        id: appliance.id,
        body: {
          doc: {
            state: 'Error',
          },
        },
      });
    }).then(() => {}, (err) => {
      context.log.error(err, `fail to update appliance ${appliance.name}`);
    });
}

module.exports.post = function post(req, res) {
  co(function* () {
    // login appliance
    const ovClient = new RESTClient(req.body.address, {
      username: req.body.username,
      password: req.body.password,
      domain: req.body.domain,
    }, req.body.ignoreCert);
    yield ovClient.login(req);

    // Get appliance supported API version
    const applianceAPIVersion = yield ovClient.get(req, { uri: '/rest/version' });
    req.log.info(`get appliance API version: ${applianceAPIVersion.currentVersion}`);
    ovClient.setHeader({
      headers: {
        'X-API-Version': applianceAPIVersion.currentVersion,
      },
    });

    // Get appliance basic information
    const applianceVersion = yield ovClient.get(req, { uri: '/rest/appliance/nodeinfo/version' });
    req.log.info(`get appliance node version: ${applianceVersion.softwareVersion}`);

    // Verify if appliance is already added
    const existingApplianceList = yield dbClient.search({
      index: 'appliances',
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
      networkInterfaces.forEach((networkInterface) => {
        if (!applianceName) {
          applianceName = networkInterface.hostname;
        }
      });
    }
    if (!applianceName) {
      networkInterfaces.forEach((networkInterface) => {
        if (!applianceName) {
          applianceName = networkInterface.app1Ipv4Addr;
        }
      });
    }

    const appliance = Object.assign({},
      {
        id: applianceVersion.serialNumber,
        category: 'appliances',
        name: applianceName,
        uri: `/rest/global/appliances/${applianceVersion.serialNumber}`,
        state: 'Adding',
        nodeinfo: {
          version: applianceVersion,
          status: applianceStatus,
        },
        'health-status': applianceHealth.members,
        'network-interfaces': networkInterfaces,
      });
    yield dbClient.create({
      index: 'appliances',
      type: 'appliances',
      id: applianceVersion.serialNumber,
      body: appliance,
    });
    req.log.info(`appliance ${appliance.name} is saved`);
    res.json(appliance);
    return appliance;
  }).then((appliance) => {
    setApplianceOnline(req, appliance);
  }, (err) => {
    req.log.error(err);
    res.json(500).end(err);
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

module.exports.updateResourceCounts = function updateResourceCounts(appliance, resourceCounts) {
  return dbClient.update({
    index: 'appliances',
    type: 'appliances',
    id: appliance.id,
    body: {
      doc: {
        resourceCounts,
      },
    },
  });
};
