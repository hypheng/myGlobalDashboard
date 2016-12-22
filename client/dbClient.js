const elasticsearch = require('elasticsearch');
const config = require('../config');

const client = elasticsearch.Client({
  host: `localhost:${config.es.esPort}`,
  log: config.es.log,
  requestTimeout: config.es.requestTimeout,
});

client.bulkCreate = function bulkCreate(category, items) {
  const bulkBody = [];
  items.forEach((item) => {
    bulkBody.push({
      create: {
        _index: category,
        _type: category,
      },
    });
    bulkBody.push({
      doc: item,
    });
  });
  return this.bulk({
    body: bulkBody,
  });
};

module.exports = client;
