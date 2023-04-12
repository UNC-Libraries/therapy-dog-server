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
const archiver = require('archiver');
const tmp = require('tmp');
const config = require('../../config');
const SwordError = require('../errors').SwordError;
const logging = require('../logging');

var options = { tmpdir: config.UPLOADS_DIRECTORY }
tmp.setGracefulCleanup();

function makeZip(submission) {
  return new Promise(function(resolve, reject) {
    logging.error("makeZip time");
    tmp.tmpName(options, function(err, zipFile) {
      logging.error("makeZip tmpName " + err);
      logging.error("makeZip zip " + zipFile);
      /* nyc ignore next */
      if (err) {
        reject(err);
        return;
      }

      let output = fs.createWriteStream(zipFile);

      output.on('close', function() {
        logging.error("makeZip archive close ");
        resolve(zipFile);
      });

      let archive = archiver.create('zip', {});
      archive.pipe(output);

      /* nyc ignore next */
      archive.on('error', function(err) {
        logging.error("makeZip archive error " + err);
        reject(err);
      });

      archive.on('warning', function(err) {
        logging.error("makeZip archive warn " + err);
      });

      Object.keys(submission).forEach(function(name) {
        if (submission[name] instanceof Buffer) {
          logging.error("makeZip archive append buffer " + name);
          archive.append(submission[name], { name: name });
        } else {
          logging.error("makeZip archive append " + name);
          archive.append(fs.createReadStream(submission[name]), { name: name });
          fs.unlink(submission[name], (err) => {
            logging.error("makeZip archive append unlink " + name + " " + err);
            if (err) {
              throw err;
            }
          });
        }
      });
      logging.error("makeZip finish ");

      try {
        archive.finalize();
      } catch (err) {
        logging.error("makeZip catch " + err);
      } finally {
        logging.error("makeZip finally " + (new Error()).stack);
      }

      logging.error("makeZip FINAL ");
    });
    logging.error("makeZip tmpName done ");
  });
}

function postZip(form, zipFile, depositorEmail) {
  logging.error("postZip Begin ");
  return new Promise(function(resolve, reject) {
    logging.error("postZip promising ");
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
    logging.error("postZip about to post ");

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
      logging.error("postZip posted ");
      /* nyc ignore if */
      if (err) {
        logging.error("postZip err " + err);
        // Ignoring ECONNRESETs for the purpose of determining if the deposit failed
        // as SWORD in some containers closes connections in a way that results in this
        // error while the deposit actually succeeds
        if (err.stack.indexOf('ECONNRESET') !== -1 && config.DEBUG !== undefined && config.DEBUG) {
          resolve();
        } else {
          reject(err);
        }
      } else if (response.statusCode !== 201) {
        logging.error("postZip status bad " + response.statusCode);
        reject(new SwordError('Received error response from SWORD endpoint', {
          statusCode: response.statusCode,
          body: body
        }));
      } else {
        logging.error("postZip good? ");
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
    logging.error("submitZip then ");
    return postZip(form, zipFile, depositorEmail);
  }).catch(function(err) {
    logging.error("submitZip error " + err);
    next(err);
  });
}

module.exports = submitZip;
