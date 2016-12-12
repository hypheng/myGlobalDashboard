'use strict';
const bunyan = require('bunyan');

const log = bunyan.createLogger({
  src: true,
  name: 'gd',
  hostname: 'local',
  level: 'info'
});

module.exports = log;
