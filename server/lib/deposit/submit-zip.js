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

const fs = require('fs');
const request = require('request');
const tmp = require('tmp');
const config = require('../../config');
const SwordError = require('../errors').SwordError;
const logging = require('../logging');
const AdmZip = require('adm-zip');

var options = { tmpdir: config.UPLOADS_DIRECTORY }
tmp.setGracefulCleanup();

function makeZip(submission) {
  return new Promise(function(resolve, reject) {
    tmp.tmpName(options, function(err, zipFile) {
      /* nyc ignore next */
      if (err) {
        logging.error('makeZip initial error ' + err);
      //   reject(err);
        return;
      }

      var zip = new AdmZip();

      Object.keys(submission).forEach(function(name) {
        logging.error('makeZip loop ' + name);
        if (submission[name] instanceof Buffer) {
          zip.addFile(name, submission[name]);
          logging.error('makeZip archive append buffer ' + name);
        } else {
          const content = fs.readFileSync(submission[name]);
          zip.addFile(name, content);
          // zip.addLocalFile(submission[name], name);
          logging.error('makeZip archive append ' + name + ' | ' + submission[name]);
          fs.unlink(submission[name], (err) => {
            logging.error('makeZip archive append unlink ' + name + ' ' + err);
            if (err) {
              throw err;
            }
          });
          logging.error('makeZip archive after unlink ' + name);
        }
      });
      logging.error('makeZip writeZip ' + zipFile);
      zip.writeZip(zipFile);
      logging.error('makeZip resolve ' + zipFile);
      resolve(zipFile);
    });
  });
}

function postZip(form, zipFile, depositorEmail) {
  return new Promise(function(resolve, reject) {
    let body = fs.readFileSync(zipFile);
    let headers = {
      'Packaging': 'http://cdr.unc.edu/METS/profiles/Simple',
      'Content-Disposition': 'attachment; filename=package.zip',
      'Content-Type': 'application/zip',
      'forwardedMail': depositorEmail
    };

    if (form.depositor !== null) {
      headers['On-Behalf-Of'] = form.depositor;
      headers['forwardedGroups'] = config.GROUPS_BASE;

      if (form.isMemberOf !== null) {
        headers['forwardedGroups'] += ';' + form.isMemberOf;
      }
    }

    request.post(form.destination, {
      strictSSL: false,
      body: body,
      baseUrl: config.SWORD_BASE_URL,
      headers: headers,
      auth: {
        username: config.SWORD_USERNAME,
        password: config.SWORD_PASSWORD,
        sendImmediately: true
      }
    }, function(err, response, body) {
      /* nyc ignore if */
      if (err) {
        // Ignoring ECONNRESETs for the purpose of determining if the deposit failed
        // as SWORD in some containers closes connections in a way that results in this
        // error while the deposit actually succeeds
        if (err.stack.indexOf('ECONNRESET') !== -1 && config.DEBUG !== undefined && config.DEBUG) {
          resolve();
        } else {
          reject(err);
        }
      } else if (response.statusCode !== 201) {
        reject(new SwordError('Received error response from SWORD endpoint', {
          statusCode: response.statusCode,
          body: body
        }));
      } else {
        resolve();
        fs.unlink(zipFile, (err) => {
          if (err) {
            throw err;
          }
        });
      }
    });
  });
}

/**
 * Generate a zip file from the `submission` and submit it to the {@link Form#destination destination} specified by the `form`.
 * @function
 * @name submitZip
 * @param {Form} form
 * @param {Submission} submission
 * @param {string} depositorEmail
 * @return {Promise}
 */
function submitZip(form, submission, depositorEmail) {
  return makeZip(submission)
    .then(function(zipFile) {
      return postZip(form, zipFile, depositorEmail);
    })
    .catch(function(err) {
      logging.error("submitZip error " + err);
      next(err);
    });
}

module.exports = submitZip;
