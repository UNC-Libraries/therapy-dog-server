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
const multer = require('multer');
const config = require('../config');
const auth = require('./auth');

let router = express.Router();
let upload = multer({ dest: config.UPLOADS_DIRECTORY });

router.use(auth.getRemoteUser);

router.use(require('body-parser').json());

router.get('/forms/:id', require('./handlers/forms').show);
router.post('/deposits', auth.requireRemoteUser, require('./handlers/deposits').create);
router.post('/deposits/debug', auth.requireRemoteUser, auth.requireDebug, require('./handlers/deposits').debug);
router.post('/uploads', auth.requireRemoteUser, upload.single('file'), require('./handlers/uploads').create);

module.exports = router;
