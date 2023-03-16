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

const winston = require('winston');
const expressWinston = require('express-winston');
const config = require('../config');

let requestLogger, errorLogger;

if (process.env.NODE_ENV === 'production') {
  let transports = [
    new winston.transports.File({
      level: 'debug',
      filename: config.LOG_FILENAME,
      json: false,
      prettyPrint: true
    })
  ];

  winston.clear();

  transports.forEach(function(transport) {
    winston.add(transport);
  });

  errorLogger = expressWinston.errorLogger({
    transports: transports
  });
} else {
  winston.clear();

  winston.add(new winston.transports.Console, {
    level: 'debug',
    prettyPrint: true,
    colorize: true
  });

  requestLogger = expressWinston.logger({
    transports: [
      new winston.transports.Console({
        json: false,
        colorize: true
      })
    ],
    expressFormat: true,
    meta: false
  });

  errorLogger = expressWinston.errorLogger({
    transports: [
      new winston.transports.Console({
        json: true
      })
    ]
  });
}

module.exports = {
  requestLogger: requestLogger,
  errorLogger: errorLogger,
  error: winston.error,
  warn: winston.warn,
  info: winston.info,
  log: winston.log,
  verbose: winston.verbose,
  debug: winston.debug,
  silly: winston.silly
};
