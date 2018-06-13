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

const Form = require('../models/form');
const config = require('../../config');
const logging = require('../../lib/logging');
const ModelNotFoundError = require('../errors').ModelNotFoundError;

exports.show = function(req, res, next) {
  Form.findById(req.params.id)
  .then(function(form) {
    if (req.remoteUser) {
      return form.getResourceObject({ children: true });
    } else {
      return form.getResourceObject();
    }
  })
  .then(function(resourceObject) {
    let meta = {};

    if (config.DEBUG) {
      meta.debug = true;
    }

    if (req.remoteUser) {
      meta.authorized = true;
    } else {
      meta.authorized = false;
    }

    if (req.headers['mail']) {
      meta.mail = req.headers['mail'];
    }

    res.header('Content-Type', 'application/vnd.api+json');
    res.send(new Buffer(JSON.stringify({
      data: resourceObject,
      meta: meta
    })));
  })
  .catch(ModelNotFoundError, function(err) {
    logging.error(err);
    res.status(404);
    res.header('Content-Type', 'application/vnd.api+json');
    res.send(new Buffer(JSON.stringify({ errors: [{ status: '404', title: 'Not found' }] })));
  })
  .catch(function(err) {
    next(err);
  });
};
