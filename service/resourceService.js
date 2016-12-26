const co = require('co');

const applianceService = require('./applianceService');
const dbClient = require('../client/dbClient');
const applianceClient = require('../client/applianceClient');
const config = require('../config');
const CONST = require('../const');
const util = require('../util');

module.exports.get = function get(req, res) {
  res.status(204).end();
};

module.exports.getList = function getList(req, res) {
  res.status(204).end();
};

module.exports.addResources = function addResources(context, appliance) {
  return co(function* addResourcesGen() {
    const timer = util.getTimer();
    context.log.info(`start to add resources from ${appliance.name}`);
    const promises = Object.keys(CONST.GD_OV_CATEGORY_MAP).map(category =>
      co(function* addCategoryGen() {
        let start = 0;
        let resourceList;
        do {
          const stepTimer = util.getTimer();
          const ovClient = yield applianceClient.getClient(appliance);
          const fetchSize = config[category].fetchSize || config.defaultFetchSize;
          resourceList = yield ovClient.get({
            uri: `/rest/${category}?start=${start}&count=${fetchSize}`,
          });
          context.log.info(`get ${resourceList.count} ${category} at `
            + `position ${start} from ${appliance.name} within ${stepTimer.duration()}`);

          yield dbClient.bulkCreate(category, resourceList.items);
          context.log.info(
            `save ${resourceList.count} ${category} into DB with ${stepTimer.duration()}`);

          yield applianceService.updateResourceCounts(appliance, {
            category: start + resourceList.count,
          });

          context.log.info(
            `update appliance's resource count within ${stepTimer.duration()}`);
          start += resourceList.count;
        } while (start + resourceList.count < resourceList.total);
      }));
    yield Promise.all(promises);
    context.log.info(`resources from ${appliance.name} are added within ${timer.duration()}`);
  });
};
