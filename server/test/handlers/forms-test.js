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
const router = require('../../lib/router');

describe('Forms handler', function() {
  it('should respond with only basic information if there is no remote_user', function(done) {
    let request = httpMocks.createRequest({
      method: 'GET',
      headers: {},
      path: '/forms/article'
    });

    let response = httpMocks.createResponse({
      eventEmitter: require('events').EventEmitter
    });

    router.handle(request, response, done);

    response.on('end', function() {
      assert.equal(200, response.statusCode);

      let document = JSON.parse(response._getData());
      assert.equal('article', document.data.id);
      assert.equal('Article Form', document.data.attributes.title);
      assert.equal(undefined, document.data.attributes.children);
      assert.equal(undefined, document.meta.authorized);

      done();
    });
  });

  it('should respond with all information if there is a remote_user', function(done) {
    let request = httpMocks.createRequest({
      method: 'GET',
      headers: {
        remote_user: 'someone',
        mail: 'someone@example.com'
      },
      path: '/forms/article'
    });

    let response = httpMocks.createResponse({
      eventEmitter: require('events').EventEmitter
    });

    router.handle(request, response);

    response.on('end', function() {
      assert.equal(200, response.statusCode, done);

      let document = JSON.parse(response._getData());
      assert.equal('article', document.data.id);
      assert.equal('Article Form', document.data.attributes.title);
      assert.ok(Array.isArray(document.data.attributes.children), 'children attribute should be an array');
      assert.equal('someone', document.meta.authorized);
      assert.equal('someone@example.com', document.meta.mail);

      done();
    });
  });

  it('should respond with 404 for a nonexistent form', function(done) {
    let request = httpMocks.createRequest({
      method: 'GET',
      headers: {},
      path: '/forms/qwerty'
    });

    let response = httpMocks.createResponse({
      eventEmitter: require('events').EventEmitter
    });

    router.handle(request, response, done);

    response.on('end', function() {
      assert.equal(404, response.statusCode);
      done();
    });
  });
});
