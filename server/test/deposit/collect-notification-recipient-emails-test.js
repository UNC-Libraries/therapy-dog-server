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
const Form = require('../../lib/models/form');
const collectNotificationRecipientEmails = require('../../lib/deposit/collect-notification-recipient-emails');

describe('collectNotificationRecipientEmails', function() {
  it('should collect using strings and lookups', function() {
    let form = new Form('test', {
      destination: 'uuid:1234',
      title: 'Test',
      notificationRecipientEmails: [
        { type: 'string', value: 'test@example.com' },
        { type: 'string', value: 'another@example.org' },
        { type: 'lookup', path: [ 'email' ] }
      ],
      children: [
        { type: 'email', key: 'email' },
        { type: 'file', key: 'thesis' }
      ],
      bundle: {
        type: 'single',
        file: {
          upload: 'thesis'
        }
      },
      metadata: []
    });

    let values = {
      email: 'blah@example.net'
    };

    assert.deepEqual(collectNotificationRecipientEmails(form, values), [ 'test@example.com', 'another@example.org', 'blah@example.net' ]);
  });

  it('should collect using an array in a vocabulary term', function() {
    let form = new Form('test', {
      destination: 'uuid:1234',
      title: 'Test',
      notificationRecipientEmails: [
        { type: 'lookup', path: [ 'major', 'emails' ] }
      ],
      children: [
        { type: 'select', key: 'major', options: 'majors' },
        { type: 'file', key: 'thesis' }
      ],
      bundle: {
        type: 'single',
        file: {
          upload: 'thesis'
        }
      },
      metadata: []
    });

    // These are transformed values -- there is no 'majors' vocabulary fixture.
    let values = {
      major: { name: 'Basket Weaving', emails: [ 'b@example.com', 'c@example.com' ] }
    };

    assert.deepEqual(collectNotificationRecipientEmails(form, values), [ 'b@example.com', 'c@example.com' ]);
  });

  it('should return an empty array if the property is absent', function() {
    let form = new Form('test', {
      destination: 'uuid:1234',
      title: 'Test',
      children: [
        { type: 'file', key: 'thesis' }
      ],
      bundle: {
        type: 'single',
        file: {
          upload: 'thesis'
        }
      },
      metadata: []
    });

    assert.deepEqual(collectNotificationRecipientEmails(form, {}), []);
  });
});
