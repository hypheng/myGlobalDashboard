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
      context.log.info(loginResponseBody, `login ${this.address} succeed`);
    }.bind(this));
  };

  const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
  HTTP_METHODS.forEach((method) => {
    this[method] = function httpMethod(context, options, body) {
      context.log.info(options, `${method} from ${this.address}`);
      return this.request[method](options).catch(err =>
        co(function* errHandlerGen() {
          if (err && err.statusCode === 401) {
            context.log.info('auth token is invalid');
            yield this.login(context);
            // retry
            return yield this.request[method](options, body);
          }
          context.log.error({ options }, `${method} error from ${this.address}${options.uri}`);
          throw err;
        }.bind(this)));
    };
  });

  this.getCert = function getCert() {
  };

  this.waitTaskComplete = function waitTaskComplete(taskUri) {
    const POLL_INTERVAL = 1000;
    return co(function* waitTaskCompleteGen() {
      let task;
      do {
        task = yield this.get({
          uri: taskUri,
        });
        yield this.wait(POLL_INTERVAL);
      } while (!task ||
          // task percentComplete can be 0 but taskState = Completed in some API
          (task.percentComplete !== 100 && task.taskState !== 'Completed'));
    }.bind(this));
  };

  this.wait = function wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  };
};
