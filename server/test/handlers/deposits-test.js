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
const httpMocks = require('node-mocks-http');
const nock = require('nock');
const createTestUpload = require('../test-helpers').createTestUpload;
const stubTransport = require('../../lib/mailer').stubTransport;
const SwordError = require('../../lib/errors').SwordError;
const router = require('../../lib/router');

function createTestDeposit() {
  return createTestUpload('article.pdf', 'application/pdf', new Buffer('lorem ipsum'))
  .then(function(article) {
    return {
      form: 'article',
      values: {
        authors: [
          { first: 'Some', last: 'Author' }
        ],
        info: {
          title: 'Test',
          language: 'eng'
        },
        roles: ['Student', 'Staff'],
        review: 'yes',
        license: 'CC-BY',
        agreement: true,
        article: article.id,
        supplemental: []
      },
      sendEmailReceipt: true,
      depositorEmail: 'depositor@example.com'
    };
  });
}

describe('Deposits handler', function() {
  it('should post a zip file to the correct endpoint and send a deposit notification email', function(done) {
    // In order to ensure that a ZIP file was posted, we check for the hex encoding of ASCII "PK" (0x504b) at the beginning of the body. nock gives us a hexadecimal string for a request body it considers "binary".
    nock('http://localhost:8182', {
      reqheaders: {
        'Packaging': 'http://cdr.unc.edu/METS/profiles/Simple',
        'Content-Type': 'application/zip',
        'forwardedMail': 'depositor@example.com'
      }
    })
    .post('/services/sword/collection/uuid:1234', /^504b/)
    .reply(201, 'SWORD response');

    createTestDeposit()
    .then(function(deposit) {
      let request = httpMocks.createRequest({
        method: 'POST',
        headers: {
          remote_user: 'someone'
        },
        path: '/deposits',
        body: deposit
      });

      let response = httpMocks.createResponse({
        eventEmitter: require('events').EventEmitter
      });

      router.handle(request, response, done);

      let expect = 3;

      response.on('end', function() {
        assert.equal(204, response.statusCode);

        if (--expect === 0) {
          done();
        }
      });

      stubTransport.on('end', function(info) {
        if (info.envelope.to[0] !== 'depositor@example.com' && info.envelope.to[0] !== 'someone@example.com') {
          throw new assert.AssertionError({ message: `Expected mail to be addressed to depositor@example.com or someone@example.com, found ${info.envelope.to}` });
        }

        assert.ok(info.response.toString());

        if (--expect === 0) {
          done();
        }
      });
    });
  });

  it('should pass an error to next() if the SWORD endpoint responds with an error', function(done) {
    nock('http://localhost:8182', {
      reqheaders: {
        'Packaging': 'http://cdr.unc.edu/METS/profiles/Simple',
        'Content-Type': 'application/zip',
        'forwardedMail': 'depositor@example.com'
      }
    })
    .post('/services/sword/collection/uuid:1234', /^504b/)
    .reply(500, 'SWORD response');

    createTestDeposit()
    .then(function(deposit) {
      let request = httpMocks.createRequest({
        method: 'POST',
        headers: {
          remote_user: 'someone'
        },
        path: '/deposits',
        body: deposit
      });

      let response = httpMocks.createResponse({
        eventEmitter: require('events').EventEmitter
      });

      let next = function(err) {
        assert.ok(err instanceof SwordError, 'the error should be an instance of SwordError');
        done();
      };

      router.handle(request, response, next);
    });
  });
});
