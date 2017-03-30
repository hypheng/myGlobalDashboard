const co = require('co');
const elasticsearch = require('elasticsearch');

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

client.createIndexIfNotExist = function createIndexIfNotExist(context, indexName) {
  return co(function* createIndexIfNotExistGen() {
    const indexExists = yield this.indices.exists({ index: indexName });
    if (!indexExists) {
      context.log.info({ indexName }, 'index not exist');
      yield this.indices.create({
        index: indexName,
        body: indexSetting[indexName] || indexSetting.default,
      });
      context.log.info({ indexName }, 'index is created');
    }
  }.bind(this));
};

client.bulkCreate = function bulkCreate(context, category, items) {
  return co(function* bulkCreateGen() {
    if (!items || items.length === 0) {
      return Promise.resolve();
    }

    yield this.createIndexIfNotExist(context, category);

    const bulkBody = [];
    items.forEach((item) => {
      bulkBody.push({
        create: {
          _index: category,
          _type: category,
          _id: item.id,
        },
      });
      bulkBody.push(item);
    });

    context.log.info({ category, count: items.length }, 'start bulk create');
    return yield this.bulk({
      body: bulkBody,
    });
  }.bind(this));
};

client.bulkIndex = function bulkIndex(context, category, items) {
  return co(function* bulkIndexGen() {
    if (!items || items.length === 0) {
      return Promise.resolve();
    }

    const bulkBody = [];
    items.forEach((item) => {
      bulkBody.push({
        index: {
          _index: category,
          _type: category,
          _id: item.id,
        },
      });
      bulkBody.push(item);
    });

    context.log.info({ category, count: items.length }, 'start bulk index');
    return yield this.bulk({
      body: bulkBody,
    });
  }.bind(this));
};

module.exports = client;
