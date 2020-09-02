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

const assert = require('assert');
const File = require('../../lib/deposit/bundle/file');
const buildTestUpload = require('../test-helpers').buildTestUpload;

describe('Bundle', function() {
  describe('files', function() {
    it('should set Buffer contents', function() {
      let file = new File(Buffer.from('123'), {});

      assert.equal(file.contents.toString(), '123');
    });

    it('should be named "untitled.txt" and have the mimetype "text/plain" unless otherwise specified if its contents are a Buffer', function() {
      let file = new File(Buffer.from('123'), {});

      assert.equal(file.name, 'untitled.txt');
      assert.equal(file.mimetype, 'text/plain');
    });

    it('should use its contents\' name and mimetype if its contents are an Upload', function() {
      let upload = buildTestUpload('numbers.txt', 'text/markdown', Buffer.from('123'));
      let file = new File(upload, {});

      assert.equal(file.name, 'numbers.txt');
      assert.equal(file.mimetype, 'text/markdown');
    });

    it('should use the optional name and mimetype if specified', function() {
      let file = new File(Buffer.from('123'), { name: 'numbers.txt', mimetype: 'text/markdown' });

      assert.equal(file.name, 'numbers.txt');
      assert.equal(file.mimetype, 'text/markdown');
    });

    it('should throw a TypeError if something other than an Upload or Buffer is passed for contents', function() {
      assert.throws(function() {
        /*jshint nonew: false */
        new File('123', {});
      }, TypeError);
    });
  });
});
