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

const config = require('../config');

exports.getRemoteUser = function(req, res, next) {
  let remoteUser = req.headers['remote_user'];

  if (remoteUser) {
    req.remoteUser = remoteUser;
  }

  next();
};

exports.requireRemoteUser = function(req, res, next) {
  if (req.remoteUser || (config.DEBUG && /AUTHENTICATION_SPOOFING/.test(req.headers.cookie))) {
    next();
  } else {
    res.status(401);
    res.send({ errors: [ { status: '401', title: 'Unauthorized' } ] });
  }
};

exports.requireDebug = function(req, res, next) {
  if (config.DEBUG) {
    next();
  } else {
    res.status(401);
    res.header('Cache-Control', 'max-age=0');
    res.send({ errors: [ { status: '401', title: 'Unauthorized' } ] });
  }
};
