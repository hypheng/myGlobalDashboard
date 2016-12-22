const util = require('../util');

module.exports = {
  saveCredential: (credential) => {
    if (!util.isProduction()) {
      return Promise.resolve(`${credential.username}:${credential.password}:
        ${credential.domain ? credential.domain : 'local'}`);
    }
    return Promise.reject(new Error('not implemented'));
  },

  getCredential: (credentialID) => {
    if (!util.isProduction()) {
      const results = credentialID.split(':');
      return Promise.resolve({
        username: results[0],
        password: results[1],
        domain: results[2],
      });
    }
    return Promise.reject(new Error('not implemented'));
  },
};
