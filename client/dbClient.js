const elasticsearch = require('elasticsearch');
const config = require('../config');

module.exports = elasticsearch.Client({
  host: `localhost:${config.es.esPort}`,
  log: config.es.log,
  requestTimeout: config.es.requestTimeout,
});
