const co = require('co');
const RESTClient = require('../client/restClient');

module.exports.post = function post(req, res) {
  const ovClient = new RESTClient(req.body.address, {
    username: req.body.username,
    password: req.body.password,
    domain: req.body.domain,
  }, req.body.ignoreCert);
  co(function* () {
    yield ovClient.login(req);
    const applianceAPIVersion = yield ovClient.get(req, { uri: '/rest/version' });
    req.log.info(`get appliance API version: ${applianceAPIVersion.currentVersion}`);
    ovClient.setHeader({
      headers: {
        'X-API-Version': applianceAPIVersion.currentVersion,
      },
    });
    const applianceVersion = yield ovClient.get(req, { uri: '/rest/appliance/nodeinfo/version' });
    req.log.info(`get appliance node version: ${applianceVersion.softwareVersion}`);
    const applianceHealth = yield ovClient.get(req, { uri: '/rest/appliance/health-status' });
    req.log.info({ applianceHealth: applianceHealth.members }, 'get appliance health status');
    const appliance = Object.assign({}, applianceVersion, { health: applianceHealth.members });
    return appliance;
  }).then((value) => {
    res.json(value);
  }, (err) => {
    req.log.error(err, '');
    res.json(400).end();
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
