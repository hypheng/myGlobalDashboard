const co = require('co');
const bunyan = require('bunyan');
const CONST = require('../const');
const util = require('../util');
const dbClient = require('../client/dbClient');
const resouceService = require('./resouceService');
const config = require('../../config');

const log = bunyan.createLogger({
  src: true,
  streams: [{
    path: config.sync.logPath,
  }],
  name: 'gd',
  hostname: 'local',
  level: 'info',
});

module.exports.startSync = function startSync() {
  let round = 1;
  const sync = () => {
    const roundLog = log.child({ round });
    roundLog.info({ round }, 'sync start');
    const timer = util.getTimer();
    co(function* syncGen() {
      const stepTimer = util.getTimer();
      const applianceCount = yield dbClient.count({
        index: CONST.CATEGORY.APPLIANCES,
      });
      roundLog.info({ duration: stepTimer.duration(), applianceCount },
        'get appliances count');

      const applianceResp = yield dbClient.search({
        index: CONST.CATEGORY.APPLIANCES,
        size: applianceCount,
        q: '*:*',
      });
      const appliances = applianceResp.hits.hits.map(item => item._source);
      roundLog.info({ duration: stepTimer.duration(), count: appliances.length },
        'get all appliances');

      const promises = appliances.map(appliance => resouceService.syncResources({
        log: roundLog.child({
          appliance: appliance.name,
        }),
      }, appliance));

      yield Promise.all(promises);

      roundLog.info({ duration: timer.duration() }, 'sync done');
      round = (round + 1) % Number.MAX_SAFE_INTEGER;
      const totalDuration = timer.lastDuration();
      if (totalDuration > config.sync.minInterval) {
        setTimeout(sync, 0);
      } else {
        setTimeout(sync, config.sync.minInterval - totalDuration);
      }
    }).catch((err) => {
      roundLog.error(err, `sync error, duration: ${timer.duration()}`);
    });
  };
  setTimeout(sync, config.sync.minInterval);
};
