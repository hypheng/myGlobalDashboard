const compression = require('compression');
const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const http = require('http');
const morgan = require('morgan');

const log = require('./log');
const config = require('../config');
const applianceService = require('./service/applianceService');
const resourceService = require('./service/resourceService');

const app = express();
app.use(compression());
app.use(bodyParser.json());
app.use(morgan('combined', {
  stream: fs.createWriteStream(`${__dirname}/../log/access.log`, {
    flags: 'a',
  }),
}));

let reqId = 0;
app.use((req, res, next) => {
  reqId += 1;
  req.log = log.child({
    reqId,
  });
  req.log.info({
    url: req.originalUrl,
    method: req.method,
    params: req.params,
    query: req.query,
    body: req.body,
  }, 'REST request received');
  next();
});

app.use((err, req, res, next) => {
  req.log.error(err, 'internal server error');
  res.status(500).end();
  next(err);
});

app.post('/rest/global/appliances', applianceService.post);
app.delete('/rest/global/appliances/:id', applianceService.delete);
app.get('/rest/global/appliances', applianceService.getList);
app.get('/rest/global/appliances/:id', applianceService.get);

app.get('/rest/global/:category', resourceService.getList);
app.get('/rest/global/:category/:id', resourceService.get);

const server = http.createServer(app);
server.listen(config.gdPort);
