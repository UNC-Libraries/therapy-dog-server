// Copyright 2017 The University of North Carolina at Chapel Hill
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
'use strict';

const express = require('express');
const config = require('./config');
const logging = require('./lib/logging');
const router = require('./lib/router');

// Start the server
let app = express();

app.use(function(req, res, next) {
  res.header('Cache-Control', 'no-cache');
  next();
});

if (logging.requestLogger) {
  app.use(logging.requestLogger);
}

app.use('/', router);

app.use(logging.errorLogger);

app.use(function(err, req, res, next) {
  /*jshint unused: vars */
  if (res.headersSent) {
    return next(err);
  }
  res.status(500);
  res.header('Content-Type', 'application/vnd.api+json');
  res.send(Buffer.from(JSON.stringify({ errors: [ { status: '500', title: 'Internal server error' } ] })));
});

let server = app.listen(config.PORT, config.HOST, function() {
  logging.info('Server started on %s:%s', server.address().address, server.address().port);
});
logging.info('Post start');
server.once('close', function(){
  logging.info('Closing server');
  process.exit(2);
});
