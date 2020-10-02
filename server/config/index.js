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

let required = [ 'HOST', 'PORT', 'SWORD_BASE_URL', 'SWORD_USERNAME', 'SWORD_PASSWORD', 'SITE_URL', 'GROUPS_BASE', 'FORMS_DIRECTORY', 'VOCABULARIES_DIRECTORY', 'UPLOADS_DIRECTORY', 'FROM_EMAIL', 'MAILER_CONNECTION_URL' ];
let optional = [ 'DEBUG' ];

if (process.env.NODE_ENV === 'production') {
  required.push('LOG_FILENAME');
}

let defaults;

if (process.env.NODE_ENV === 'production') {
  defaults = require('./production');
} else if (process.env.NODE_ENV === 'test') {
  defaults = require('./test');
} else {
  defaults = require('./development');
}

let config = required.concat(optional).reduce(function(hash, key) {
  hash[key] = process.env[key] || defaults[key];
  return hash;
}, {});

let missing = required.filter(function(key) {
  return !config[key];
});

if (missing.length > 0) {
  console.error('\nMissing configuration variables: ' + missing.join(', '));
  process.exit(1);
}

module.exports = config;
