const util = require('../util');

module.exports = {
  saveCredential: (resourceUri, credential) => {
    if (!util.isProduction) {
      return { id: `${credential.username}:${credential.password}` };
    }
    throw new Error('not implemented');
  },
  getCredential: (credentialID) => {
    const results = credentialID.split(':');
    return {
      username: results[0],
      password: results[1],
    };
  },
};
