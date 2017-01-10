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
    clientStore[appliance.id] = client;
    return client;
  });
};

module.exports.cacheClient = function cacheClient(appliance, client) {
  clientStore[appliance.id] = client;
};
