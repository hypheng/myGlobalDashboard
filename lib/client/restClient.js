const request = require('request-promise');
const co = require('co');
/*
 * Create REST client for Atlas based appliance
 */
module.exports = function RestClient(address, credential, ignoreCert) {
  this.address = address;
  this.credential = credential;
  this.ignoreCert = ignoreCert;
  this.request = request.defaults({
    baseUrl: `https://${address}`,
    rejectUnauthorized: !ignoreCert,
    json: true, // auto parse response body
    forever: true, // connection: keep-alive
    timeout: 3000,
  });
  // This function set the header permanently in client
  // To set header temporary, just pass the header in the options
  this.addHeader = function addHeader(key, value) {
    this.request = this.request.defaults({
      headers: {
        [key]: value,
      },
    });
  };
  this.login = function login(context) {
    const { username, password, domain } = this.credential;
    context.log.info({
      username,
      domain,
      ignoreCert: this.ignoreCert,
    }, `login ${this.address}`);
    return co(function* loginGen() {
      const loginResponseBody = yield this.request.post({
        uri: '/rest/login-sessions',
        headers: {
          'X-API-Version': 120,
        },
        json: {
          userName: username,
          password,
          authLoginDomain: domain || 'Local',
        },
      });
      this.request = this.request.defaults({
        headers: {
          auth: loginResponseBody.sessionID,
        },
      });
      context.log.info({ loginResponseBody }, `login ${this.address} succeed`);
    }.bind(this));
  };
  this.getCert = function getCert() {
  };
  this.get = function get(context, options) {
    context.log.info({ options }, `get from ${this.address}`);
    return this.request.get(options);
  };
  this.post = function post(context, options) {
    context.log.info({ options }, `post to ${this.address}`);
    return this.request.post(options);
  };
  this.put = function put(context, options) {
    context.log.info({ options }, `put to ${this.address}`);
    return this.request.put(options);
  };
  this.patch = function patch(context, options) {
    context.log.info({ options }, `patch to ${this.address}`);
    return this.request.patch(options);
  };
  this.delete = function del(context, options) {
    context.log.info({ options }, `delete from ${this.address}`);
    return this.request.delete(options);
  };
  this.reconnect = function reconnect(context) {
    return this.login(context);
  };
};
