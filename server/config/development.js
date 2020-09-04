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

const os = require('os');
const path = require('path');

module.exports = {
  HOST: '127.0.0.1',
  PORT: '3000',
  SWORD_BASE_URL: 'http://localhost:8182/services/sword/collection/',
  SWORD_USERNAME: 'depositforms',
  SWORD_PASSWORD: 'depositforms',
  SITE_URL: 'https://example.com',
  GROUPS_BASE: 'unc:app:lib:cdr:depositor:depositforms',
  FORMS_DIRECTORY: path.join(__dirname, '../data/forms'),
  VOCABULARIES_DIRECTORY: path.join(__dirname, '../data/vocabularies'),
  UPLOADS_DIRECTORY: path.join(os.tmpdir(), 'data/uploads'),
  FROM_EMAIL: 'admin@example.com',
  MAILER_CONNECTION_URL: 'smtp://localhost:1025',
  DEBUG: true
};
