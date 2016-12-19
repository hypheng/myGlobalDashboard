const bunyan = require('bunyan');

module.exports = bunyan.createLogger({
  src: true,
  name: 'gd',
  hostname: 'local',
  level: 'info',
});
