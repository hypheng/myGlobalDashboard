const co = require('co');
const elasticsearch = require('elasticsearch');
const uuid = require('node-uuid');
const config = require('../../config');
const indexSetting = require('../../indexSetting');

const client = elasticsearch.Client({
  host: `localhost:${config.es.esPort}`,
  log: {
    type: 'file',
    level: config.es.level,
    path: config.es.path,
  },
  requestTimeout: config.es.requestTimeout,
});

client.bulkCreate = function bulkCreate(context, category, items) {
  return co(function* bulkCreateGen() {
    if (!items || items.length === 0) {
      return Promise.resolve();
    }

    const indexExists = yield this.indices.exists({ index: category });
    if (!indexExists) {
      context.log.info(`index ${category} not exist`);
      yield this.indices.create({
        index: category,
        body: indexSetting[category] || indexSetting.default,
      });
      context.log.info(`index ${category} is created`);
    }

    const bulkBody = [];
    items.forEach((item) => {
      bulkBody.push({
        create: {
          _index: category,
          _type: category,
          _id: uuid.v1(),
        },
      });
      bulkBody.push(item);
    });

    context.log.info(`start bulk create ${items.length} items on index ${category}`);
    return yield this.bulk({
      body: bulkBody,
    });
  }.bind(this));
};

module.exports = client;
