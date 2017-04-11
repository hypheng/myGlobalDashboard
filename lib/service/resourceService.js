const co = require('co');
const uuid = require('node-uuid');

const applianceService = require('./applianceService');
const dbClient = require('../client/dbClient');
const applianceClient = require('../client/applianceClient');
const config = require('../../config');
const CONST = require('../const');
const util = require('../util');

module.exports.get = function get(req, res) {
  res.status(204).end();
};

module.exports.getList = function getList(req, res) {
  res.status(204).end();
};

// set GD specific attribute into resource
function setGDResourceAttribute(context, appliance, category, resource) {
  resource.id = uuid.v1();
  resource.originalId = resource.id;
  resource.uri = `/rest/global/${category}/${resource.id}`;
  resource.applianceInfo = {
    name: applianceService.getDefaultApplianceName(context, appliance),
    id: appliance.id,
  };
}

module.exports.addResources = function addResources(context, appliance) {
  return co(function* addResourcesGen() {
    const timer = util.getTimer();
    context.log.info('start to add resources');
    const promises = Object.keys(CONST.GD_OV_CATEGORY_MAP).map(category =>
      co(function* addCategoryGen() {
        const perCategoryLog = context.log.child({
          category,
        });
        let start = 0;
        let resourceList;
        do {
          const ovClient = yield applianceClient.getClient(context, appliance);
          const fetchSize = config[category].fetchSize || config.fetch.defaultFetchSize;
          const stepTimer = util.getTimer();

          // fetch paged resources from OneView
          resourceList = yield ovClient.get(context, {
            uri: `/rest/${CONST.GD_OV_CATEGORY_MAP[category]}?start=${start}&count=${fetchSize}`
              + `&${config[category].fetchFilter || ''}`,
          });
          perCategoryLog.info({
            start,
            count: resourceList.count,
            duration: stepTimer.duration(),
          }, 'fetch resources');

          resourceList.members.forEach((member) => {
            setGDResourceAttribute(context, appliance, category, member);
          });

          yield dbClient.bulkCreate(context, category, resourceList.members);
          perCategoryLog.info({
            count: resourceList.count,
            duration: stepTimer.duration(),
          },
          'save resources into DB');

          yield applianceService.updateResourceCounts(context, appliance, {
            [category]: start + resourceList.count,
          });

          perCategoryLog.info({
            duration: stepTimer.duration(),
          },
          'update appliance\'s resource count');
          start += resourceList.count;
        } while (start < resourceList.total);
      }));
    yield Promise.all(promises);
    context.log.info({
      duration: timer.duration(),
    }, 'resources are added');
  });
};

module.exports.syncResources = function syncResources(context, appliance) {
  return co(function* syncResourcesGen() {
    const timer = util.getTimer();
    context.log.info({ appliance: appliance.name }, 'start to sync resources');
    const promises = Object.keys(CONST.GD_OV_CATEGORY_MAP).map(category =>
      co(function* syncCategoryGen() {
        const perCategoryLog = context.log.child({
          appliance: appliance.name,
          category,
        });
        const newlyDiscoveredResourceIds = [];
        let start = 0;
        let resourceList;
        do {
          const ovClient = yield applianceClient.getClient(context, appliance);
          const fetchSize = config[category].fetchSize || config.fetch.defaultFetchSize;
          const stepTimer = util.getTimer();

          // fetch paged resources from OneView
          resourceList = yield ovClient.get(context, {
            uri: `/rest/${CONST.GD_OV_CATEGORY_MAP[category]}?start=${start}&count=${fetchSize}`
              + `&${config[category].fetchFilter || ''}`,
          });
          perCategoryLog.info({
            start,
            count: resourceList.count,
            duration: stepTimer.duration(),
          }, 'fetch resources');

          // find existing corresponding resources in db
          const should = resourceList.members.map(member => ({
            term: {
              originalId: member.id,
            },
          }));

          let idToGDResource = {};
          const exists = yield dbClient.indices.exists({
            index: category,
          });
          if (!exists) {
            context.log.info({ category }, 'index not exist');
          } else {
            const searchResponse = yield dbClient.search({
              index: category,
              body: {
                query: {
                  bool: {
                    must: {
                      term: {
                        'applianceInfo.id': appliance.id,
                      },
                    },
                    should,
                    minimum_should_match: 1,
                  },
                },
              },
            });

            // find changed resources and new resources
            context.log.info({ searchResponse });
            if (searchResponse && searchResponse.hits
                && searchResponse.hits.total > 0) {
              idToGDResource = searchResponse.hits.hits.reduce((map, item) => {
                map[item._source.id] = item._source;
                return map;
              }, {});
            }
          }

          const changedResources = [];
          const newResources = [];
          resourceList.members.forEach((member) => {
            // side effect to cache the ids for delete stale resources
            newlyDiscoveredResourceIds.push(member.id);

            if (!idToGDResource[member.id]) {
              newResources.push(member);
            } else if (idToGDResource[member.id].modified !== member.modified) {
              changedResources.push(member);
            } else {
              // do nothing
            }
          });

          if (changedResources.length > 0 || newResources.length > 0) {
            perCategoryLog.info({
              start,
              count: resourceList.count,
              changedCount: changedResources.length,
              newCount: newResources.length,
              duration: stepTimer.duration(),
            }, 'resources need save into db');

            const resourcesToSave = [...changedResources, ...newResources];
            resourcesToSave.forEach((resource) => {
              setGDResourceAttribute(context, appliance, category, resource);
            });

            // save changed and new resources into db
            yield dbClient.bulkIndex(context, category, resourcesToSave);

            perCategoryLog.info({
              duration: stepTimer.duration(),
            }, 'save new or changed resources into DB');
          } else {
            perCategoryLog.info({
              start,
              count: resourceList.count,
              duration: stepTimer.duration(),
            }, 'no new or changed resource in the range');
          }

          start += resourceList.count;
        } while (start < resourceList.total);

        // delete stale resource in db

        // update count for the category in appliance
        yield applianceService.updateResourceCounts(context, appliance, {
          [category]: start + resourceList.count,
        });
      }));
    yield Promise.all(promises);

    context.log.info(`resources are added within ${timer.duration()}`);
  });
};
