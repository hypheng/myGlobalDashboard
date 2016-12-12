'use strict';
const compression = require('compression');
const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const http = require('http');
const morgan = require('morgan');

const log = require('./log');
const applianceService = require('./service/applianceService');
const resourceService = require('./service/resourceService');

const PORT = 7010;

let app = express();
app.use(compression());
app.use(bodyParser.json());
app.use(morgan('combined', {
  stream: fs.createWriteStream(__dirname + '/access.log', {flags: 'a'})
}));

let reqId = 0;
app.use(function (req, res, next) {
  req.log = log.child({reqId: reqId++});
  req.log.info({url: req.originalUrl, method: req.method, params: req.params, query: req.query},
    'REST request received');
  next();
});

app.post('/rest/global/appliances', applianceService.post);
app.delete('/rest/global/appliances/:id', applianceService.delete);
app.get('/rest/global/appliances', applianceService.getList);
app.get('/rest/global/appliances/:id', applianceService.get);

app.get('/rest/global/:category', resourceService.getList);
app.get('/rest/global/:category/:id', resourceService.get);

let server = http.createServer(app);
server.listen(PORT);
