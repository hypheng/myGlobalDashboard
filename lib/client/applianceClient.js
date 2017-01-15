const co = require('co');
const RestClient = require('./restClient');
const gdBaseClient = require('./gdBaseClient');

// It store all clients, applianceId => client
const clientStore = {};

module.exports.getClient = function getClient(context, appliance) {
  if (clientStore[appliance.id]) {
    return Promise.resolve(clientStore[appliance.id]);
  }

  return co(function* getClientGen() {
    const credential = yield gdBaseClient.getCredential(appliance.credentialId);
    const client = new RestClient(appliance.address, credential, appliance.ignoreCert);
    yield client.login(context);
    client.addHeader('X-API-Version', appliance['X-API-Version']);
    this.cacheClient(context, appliance, client);
    return client;
  }.bind(this));
};

module.exports.cacheClient = function cacheClient(context, appliance, client) {
  clientStore[appliance.id] = client;
};
