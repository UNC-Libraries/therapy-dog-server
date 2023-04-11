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

const Upload = require('../models/upload');
const logging = require('../../lib/logging');

exports.create = function(req, res, next) {
  Upload.createFromFile(req.file)
    .then(function(upload) {
      logging.error("uploading ");
      return upload.getResourceObject();
    })
    .then(function(data) {
      logging.error("uploading with data");
      res.header('Content-Type', 'application/vnd.api+json');
      res.send(Buffer.from(JSON.stringify({ data: data })));
    })
    .catch(function(err) {
      next(err);
    });
};
