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
const Vocabulary = require('../../lib/models/vocabulary');
const CheckerError = require('../../lib/checker').CheckerError;

describe('Vocabulary', function() {
  it('can find a vocabulary by id', function() {
    return Vocabulary.findById('language').then(function(vocab) {
      assert.equal(vocab.id, 'language');
      assert.equal(vocab.labelKey, 'name');
    });
  });

  it('can have notes in options', function() {
    return Vocabulary.findById('cc').then(function(vocab) {
      assert.equal(vocab.noteKey, 'description');
      assert.ok(vocab.options[0].note);
    });
  });

  describe('constructor', function() {
    it('throws a CheckerError when passed invalid attributes', function() {
      // Missing the labelKey and valueKey properties.
      let invalid = {
        terms: [ { code: 'eng', name: 'English' } ]
      };

      assert.throws(function() {
        /*jshint nonew: false */
        new Vocabulary(null, invalid);
      }, CheckerError);
    });
  });
});
