const applianceService = require('./applianceService');

module.exports.get = function get(req, res) {
  res.status(204).end();
};
module.exports.getList = function getList(req, res) {
  res.status(204).end();
};

module.exports.addResourcesFrom = function addResourcesFrom(appliance) {
  applianceService.updateResourceCounts(appliance, {});
};
