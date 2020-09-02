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

const Promise = require('bluebird');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const assert = require('assert');
const ModelNotFoundError = require('../errors').ModelNotFoundError;

/**
 * Look in the directory for a file named by id with the extension ".json" and attempt to create a new instance using the constructor, passing the id and the parsed JSON contents of the file. Return a Promise resolving to the new instance.
 * <p>This function is used by the Form and Vocabulary models.</p>
 * @function findById
 * @param {String} directory The directory to search.
 * @param {Object} constructor The constructor function.
 * @param {String} id The identifier of the model to search for.
 * @return {Promise}
 * @throws {ModelNotFoundError} If the identifier is invalid or would cause the function to access a file outside the `directory`, or the file cannot be found or read, or there is a JSON parsing error, or the constructor throws an error.
 */
exports.findById = function(directory, constructor, id) {
  return Promise.try(function() {
    assert(typeof id === 'string', 'id must be a string');
    assert(id.indexOf(path.sep) === -1, 'id must not contain the path separator');

    let filename = path.join(directory, id + '.json');

    return fs.accessAsync(filename, fs.R_OK)
      .then(function() {
        return fs.readFileAsync(filename, 'utf8');
      })
      .then(function(data) {
        return new constructor(id, JSON.parse(data));
      });
  })
    .catch(function(err) {
      throw new ModelNotFoundError(`Couldn't load "${id}": ${err.message}`, { cause: err, directory, constructor, id });
    });
};
