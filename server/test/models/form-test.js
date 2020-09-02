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
const Promise = require('bluebird');
const path = require('path');
const moment = require('moment');
const config = require('../../config');
const CheckerError = require('../../lib/checker').CheckerError;
const Form = require('../../lib/models/form');
const ModelNotFoundError = require('../../lib/errors').ModelNotFoundError;
const createTestUpload = require('../test-helpers').createTestUpload;

function assertFindById(id) {
  return Form.findById(id)
    .then(function() {
      assert(false);
    })
    .catch(function(error) {
      assert.ok(error instanceof ModelNotFoundError, 'error should be an instance of ModelNotFoundError');
    });
}

describe('Form', function() {
  describe('findById', function() {
    it('can find a form by id', function() {
      return Form.findById('article').then(function(form) {
        assert.equal(form.id, 'article');
        assert.equal(form.title, 'Article Form');
      });
    });

    it('rejects with ModelNotFoundError for a nonexistent form', function() {
      return assertFindById('qwerty');
    });

    it('rejects with ModelNotFoundError for a form with invalid JSON', function() {
      return assertFindById('invalid-syntax');
    });

    it('rejects with ModelNotFoundError for an invalid form', function() {
      return assertFindById('invalid-type');
    });

    it('rejects with ModelNotFoundError when given an invalid id', function() {
      return assertFindById(undefined);
    });

    it('rejects with ModelNotFoundError when given an id that contains the path separator', function() {
      return assertFindById(path.join('..', 'vocabularies', 'role'));
    });

    it('includes a cause, id, constructor, and directory when rejecting', function() {
      return Form.findById('qwerty')
        .then(function() {
          assert(false);
        })
        .catch(function(error) {
          assert.ok(error.extra.cause);
          assert.equal(error.extra.id, 'qwerty');
          assert.equal(error.extra.constructor, Form);
          assert.equal(error.extra.directory, config.FORMS_DIRECTORY);
        });
    });
  });

  describe('constructor', function() {
    it('throws a CheckerError when passed invalid attributes', function() {
      // Missing the 'upload' property in bundle.
      let invalid = {
        destination: 'uuid:1234',
        title: 'My Form',
        children: [
          { type: 'file', key: 'main' }
        ],
        bundle: {
          type: 'single'
        },
        metadata: []
      };

      assert.throws(function() {
        /*jshint nonew: false */
        new Form(null, invalid);
      }, CheckerError);
    });

    it('throws a CheckerError when passed invalid metadata template in attributes', function() {
      let invalid = {
        destination: 'uuid:1234',
        title: 'My Form',
        children: [
          { type: 'file', key: 'main' }
        ],
        bundle: {
          type: 'single',
          upload: 'main'
        },
        metadata: [
          {
            id: 'mods',
            type: 'descriptive',
            model: 'xml',
            template: { invalid: 'template' }
          }
        ]
      };

      assert.throws(function() {
        /*jshint nonew: false */
        new Form(null, invalid);
      }, CheckerError);
    });
  });

  it('may have a contact', function() {
    return Form.findById('article').then(function(form) {
      assert.deepEqual(form.contact, { name: 'Someone', email: 'someone@example.com' });
    });
  });

  it('may have an overridden destination', function() {
    return Form.findById('article').then(function(form) {
      assert.deepEqual(form.allowDestinationOverride, true);
    });
  });

  it('may have an add another link', function() {
    return Form.findById('article').then(function(form) {
      assert.deepEqual(form.addAnother, true);
    });
  });

  it('may have custom add another text', function() {
    return Form.findById('article').then(function(form) {
      assert.deepEqual(form.addAnotherText, 'image');
    });
  });

  it('may submit a form as the currently logged in user', function() {
    return Form.findById('article').then(function(form) {
      assert.deepEqual(form.submitAsCurrentUser, true);
    });
  });

  it('can optionally not send emails', function() {
    return Form.findById('article').then(function(form) {
      assert.deepEqual(form.sendEmailReceipt, false);
    });
  });

  describe('#getResourceObject()', function() {
    it('converts object array vocabularies to options arrays', function() {
      return Form.findById('article')
        .then(function(form) {
          return form.getResourceObject({ children: true });
        })
        .then(function(resourceObject) {
          let language = resourceObject.attributes.children[1].children[1];
          assert.deepEqual(language.options, [
            { label: 'English', value: 'eng' },
            { label: 'Spanish; Castilian', value: 'spa' }
          ]);
        });
    });

    it('converts array vocabularies or literal options to options arrays', function() {
      return Form.findById('article')
        .then(function(form) {
          return form.getResourceObject({ children: true });
        })
        .then(function(resourceObject) {
          let roles = resourceObject.attributes.children.find(c => c.key === 'roles');
          assert.deepEqual(roles.options, [ { label: 'Student', value: 'Student' }, { label: 'Faculty', value: 'Faculty' }, { label: 'Staff', value: 'Staff' } ]);

          let review = resourceObject.attributes.children.find(c => c.key === 'review');
          assert.deepEqual(review.options, [ { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' } ]);

          let license = resourceObject.attributes.children.find(c => c.key === 'license');
          assert.deepEqual(license.options, [ { label: 'CC-BY', value: 'CC-BY' }, { label: 'CC-BY-NC', value: 'CC-BY-NC' } ]);
        });
    });

    it('should include title, description, and contact information', function() {
      return Form.findById('article')
        .then(function(form) {
          return form.getResourceObject();
        })
        .then(function(resourceObject) {
          assert.ok(resourceObject.attributes.title);
          assert.ok(resourceObject.attributes.description);
          assert.ok(resourceObject.attributes.contact);
        });
    });
  });

  describe('#deserializeInput()', function() {
    it('transforms values to the correct shape, with correct vocabulary terms and upload instances', function() {
      let form = Form.findById('article');
      let uploads = Promise.props({
        article: createTestUpload('article.pdf', 'application/pdf', new Buffer('lorem ipsum')),
        supplemental: createTestUpload('data.csv', 'application/csv', new Buffer('lorem ipsum'))
      });

      return Promise.all([ form, uploads ]).spread((form, uploads) => form.deserializeInput({
        authors: [
          { first: 'Some', last: 'Author' },
          { first: 'Another', last: 'Author' }
        ],
        info: {
          title: 'My Article',
          language: 'eng'
        },
        embargo: 'P1Y',
        roles: [ 'Staff', 'Faculty' ],
        review: 'no',
        article: uploads.article.id,
        supplemental: [
          uploads.supplemental.id
        ],
        agreement: true
      }))
        .then(function(values) {
          assert.deepEqual(values.authors, [
            { first: 'Some', last: 'Author' },
            { first: 'Another', last: 'Author' }
          ]);
          assert.equal(values.info.title, 'My Article');
          assert.deepEqual(values.info.language, { code: 'eng', name: 'English' });
          assert.equal(values.embargo, moment().add(1, 'year').format('YYYY-MM-DD'));
          assert.deepEqual(values.roles, [ 'Staff', 'Faculty' ]);
          assert.equal(values.review, 'no');
          assert.equal(values.article.name, 'article.pdf');
          assert.deepEqual(values.supplemental.map(u => u.name), [ 'data.csv' ]);
          assert.deepEqual(values.agreement, {
            name: 'Deposit Agreement',
            uri: 'http://example.com/agreement',
            prompt: 'I agree to the terms in the agreement.'
          });
        });
    });
  });

  describe('It deals correctly with special characters', function() {
    it('transforms values to the correct shape, with correct vocabulary terms and upload instances', function() {
      let form = Form.findById('article');
      let uploads = Promise.props({
        article: createTestUpload('article.pdf', 'application/pdf', new Buffer('lorem ipsum')),
        supplemental: createTestUpload('data.csv', 'application/csv', new Buffer('lorem ipsum'))
      });

      return Promise.all([ form, uploads ]).spread((form, uploads) => form.deserializeInput(form.sanitizeInput({
        authors: [
          { first: 'Some', last: 'Author' },
          { first: 't​C', last: 'Author' },
          { first: '-$1.00', last: 'Author' },
          { first: '-9223372036854775808/-1', last: 'Author' },
          { first: '<script>alert(123)</script>', last: 'Author' },
          { first: '𠲖', last: 'Author' },
          { first: '﷽', last: 'Author' },
          { first: 'ȺȾ', last: 'Author' },
          { first: '🐵 🙈 🙉 🙊', last: 'Author' },
          { first: 'Powerلُلُصّبُلُلصّبُررً ॣ ॣh ॣ ॣ冗', last: 'Author' },
          { first: 'Iñtërnâtiônàlizætiøn💩☃', last: 'Author' }
        ],
        info: {
          title: 'My Article',
          language: 'eng'
        },
        embargo: 'P1Y',
        roles: [ 'Staff', 'Faculty' ],
        review: 'no',
        article: uploads.article.id,
        supplemental: [
          uploads.supplemental.id
        ],
        agreement: true
      })))
        .then(function(values) {
          assert.deepEqual(values.authors, [
            { first: 'Some', last: 'Author' },
            { first: 'tC', last: 'Author' }, // Should strip the zero-width character between t & C above
            { first: '-$1.00', last: 'Author' },
            { first: '-9223372036854775808/-1', last: 'Author' },
            { first: '&lt;script>alert(123)&lt;/script>', last: 'Author' }, // Should sanitize HTML tags or strip them
            { first: '𠲖', last: 'Author' }, // Somehow, this one fails in the deposit form, but would pass the unit test
            { first: '﷽', last: 'Author' },
            { first: 'ȺȾ', last: 'Author' },
            { first: '🐵 🙈 🙉 🙊', last: 'Author' },
            { first: 'Powerلُلُصّبُلُلصّبُررً ॣ ॣh ॣ ॣ冗', last: 'Author' },
            { first: 'Iñtërnâtiônàlizætiøn💩☃', last: 'Author' }
          ]);
        });
    });
  });

  describe('#summarizeInput()', function() {
    it('should transform input to a summary usable by mailers', function() {
      let form = Form.findById('article');
      let article = createTestUpload('article.pdf', 'application/pdf', new Buffer('lorem ipsum'));
      let summary = Promise.all([ form, article ]).spread((f, a) => f.summarizeInput({
        authors: [
          { first: 'Some', last: 'Author' }
        ],
        info: {
          title: 'My Article',
          language: 'eng'
        },
        roles: [ 'Staff', 'Faculty' ],
        embargo: '',
        review: 'no',
        license: 'CC-BY',
        agreement: true,
        article: a.id,
        supplemental: []
      }));

      return summary.then(function(s) {
        assert.deepEqual(s, [
          {
            label: 'Authors',
            section: true,
            repeat: true,
            displayInline: false,
            value: [
              [
                { label: 'First Name', value: 'Some' },
                { label: 'Last Name', value: 'Author' }
              ]
            ]
          },
          {
            label: 'Info',
            section: true,
            displayInline: false,
            value: [
              { label: 'Title', value: 'My Article' },
              { label: 'Language', value: 'English' }
            ]
          },
          { label: 'Embargo', value: '' },
          { label: 'Roles', value: 'Staff, Faculty' },
          { label: 'Needs Review?', value: 'No' },
          { label: 'License', value: 'CC-BY' },
          { label: 'Deposit Agreement', value: 'Accepted' },
          { label: 'Article', value: 'article.pdf' },
          { label: 'Supplemental', value: '(none)' }
        ]);
      });
    });

    it('does not assign terms not found in a literal options array', function() {
      let form = Form.findById('article');
      let article = createTestUpload('article.pdf', 'application/pdf', new Buffer('lorem ipsum'));
      let summary = Promise.all([ form, article ]).spread((f, a) => f.summarizeInput({
        authors: [
          { first: 'Some', last: 'Author' }
        ],
        info: {
          title: 'My Article',
          language: 'eng'
        },
        roles: [ 'Staff', 'Faculty', 'President' ],
        embargo: '',
        review: 'maybe',
        license: 'CC-BY',
        agreement: true,
        article: a.id,
        supplemental: []
      }));

      return summary.then(function(s) {
        assert.deepEqual(s, [
          {
            label: 'Authors',
            section: true,
            repeat: true,
            displayInline: false,
            value: [
              [
                { label: 'First Name', value: 'Some' },
                { label: 'Last Name', value: 'Author' }
              ]
            ]
          },
          {
            label: 'Info',
            section: true,
            displayInline: false,
            value: [
              { label: 'Title', value: 'My Article' },
              { label: 'Language', value: 'English' }
            ]
          },
          { label: 'Embargo', value: '' },
          { label: 'Roles', value: 'Staff, Faculty' },
          { label: 'Needs Review?', value: '(none)' },
          { label: 'License', value: 'CC-BY' },
          { label: 'Deposit Agreement', value: 'Accepted' },
          { label: 'Article', value: 'article.pdf' },
          { label: 'Supplemental', value: '(none)' }
        ]);
      });
    });
  });
});
