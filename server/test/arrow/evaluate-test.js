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

const Arrow = require('../../lib/arrow');
const deepEqual = require('assert').deepEqual;

describe('Evaluate', function() {
  it('should evaluate a string expression', function() {
    let template = new Arrow({ type: 'string', value: 'Lorem ipsum' });

    let context = {};

    let expected = 'Lorem ipsum';

    deepEqual(template.evaluate(context), expected);
  });

  it('should evaluate a structure expression', function() {
    let template = new Arrow({
      type: 'structure',
      name: 'namePart',
      properties: {
        type: { type: 'string', value: 'given' }
      },
      children: [
        { type: 'string', value: 'Someone' }
      ]
    });

    let context = {};

    let expected = {
      type: 'namePart',
      properties: { type: 'given' },
      children: [ 'Someone' ]
    };

    deepEqual(template.evaluate(context), expected);
  });

  it('should evaluate a lookup expression', function() {
    let template = new Arrow({ type: 'lookup', path: [ 'title' ] });

    let context = { title: 'Lorem ipsum' };

    deepEqual(template.evaluate(context), 'Lorem ipsum');
  });

  it('should evaluate a lookup expression with a path to an undefined value', function() {
    let template = new Arrow({ type: 'lookup', path: [ 'affiliation' ] });

    let context = {};

    deepEqual(template.evaluate(context), undefined);
  });

  it('should evaluate an each expression', function() {
    let template = new Arrow({
      type: 'each',
      items: { type: 'lookup', path: [ 'authors' ] },
      locals: {
        item: 'author'
      },
      body: [
        { type: 'lookup', path: [ 'author', 'first' ] }
      ]
    });

    let context = {
      authors: [
        { first: 'Someone' },
        { first: 'Another' }
      ]
    };

    let expected = [ 'Someone', 'Another' ];

    deepEqual(template.evaluate(context), expected);
  });

  it('should make the index available as a local in an each expression', function() {
    let template = new Arrow({
      type: 'each',
      items: { type: 'lookup', path: [ 'authors' ] },
      locals: {
        index: 'i'
      },
      body: [
        { type: 'lookup', path: [ 'i' ] }
      ]
    });

    let context = {
      authors: [
        { first: 'Someone' },
        { first: 'Another' }
      ]
    };

    let expected = [ 0, 1 ];

    deepEqual(template.evaluate(context), expected);
  });

  it('should evaluate an each expression which looks up something undefined', function() {
    let template = new Arrow({
      type: 'each',
      items: { type: 'lookup', path: [ 'authors' ] },
      locals: {
        item: 'author'
      },
      body: [
        { type: 'lookup', path: [ 'author', 'first' ] }
      ]
    });

    let context = {};

    deepEqual(template.evaluate(context), undefined);
  });

  it('should evaluate an each expression that looks up a non-array value', function() {
    let template = new Arrow({
      type: 'each',
      items: { type: 'lookup', path: [ 'author' ] },
      locals: {
        item: 'a'
      },
      body: [
        { type: 'lookup', path: [ 'author' ] }
      ]
    });

    let context = {
      author: 'Someone'
    };

    deepEqual(template.evaluate(context), [ 'Someone' ]);
  });

  it('should evaluate a choose expression', function() {
    let template = new Arrow({
      type: 'choose',
      choices: [
        {
          predicates: [
            { type: 'present', value: { type: 'lookup', path: [ 'stuff' ] } }
          ],
          body: [
            { type: 'string', value: 'stuff' }
          ]
        },
        {
          predicates: [
            { type: 'present', value: { type: 'lookup', path: [ 'other' ] } }
          ],
          body: [
            { type: 'string', value: 'other' }
          ]
        }
      ],
      otherwise: [
        { type: 'string', value: 'nothing' }
      ]
    });

    deepEqual(template.evaluate({ stuff: '123', other: '456' }), [ 'stuff' ]);
    deepEqual(template.evaluate({ other: '456' }), [ 'other' ]);
    deepEqual(template.evaluate({}), [ 'nothing' ]);
  });

  it('should consider an empty array to be not present in a choose expression', function() {
    let template = new Arrow({
      type: 'choose',
      choices: [
        {
          predicates: [
            { type: 'present', value: { type: 'lookup', path: [ 'stuff' ] } }
          ],
          body: [
            { type: 'string', value: 'stuff' }
          ]
        }
      ],
      otherwise: [
        { type: 'string', value: 'nothing' }
      ]
    });

    deepEqual(template.evaluate({ stuff: [] }), [ 'nothing' ]);
  });

  it('should produce an empty array for the otherwise branch in a choose expression if no otherwise property is specified', function() {
    let template = new Arrow({
      type: 'choose',
      choices: [
        {
          predicates: [
            { type: 'present', value: { type: 'lookup', path: [ 'stuff' ] } }
          ],
          body: [
            { type: 'string', value: 'stuff' }
          ]
        }
      ]
    });

    deepEqual(template.evaluate({}), []);
  });

  it('should evaluate an arrow expression', function() {
    let template = new Arrow({
      type: 'arrow',
      items: { type: 'lookup', path: [ 'roles' ] },
      target: [
        { type: 'structure', name: 'role' },
        { type: 'structure', name: 'roleTerm' }
      ]
    });

    let context = { roles: [ 'Author', 'Editor' ] };

    let expected = [
      {
        type: 'role',
        properties: {},
        children: [
          {
            type: 'roleTerm',
            properties: {},
            children: [ 'Author' ]
          }
        ]
      },
      {
        type: 'role',
        properties: {},
        children: [
          {
            type: 'roleTerm',
            properties: {},
            children: [ 'Editor' ]
          }
        ]
      }
    ];

    deepEqual(template.evaluate(context), expected);
  });

  it('should evaluate an arrow expression which looks up a string', function() {
    let template = new Arrow({
      type: 'arrow',
      items: { type: 'lookup', path: [ 'role' ] },
      target: [
        { type: 'structure', name: 'role' },
        { type: 'structure', name: 'roleTerm' }
      ]
    });

    let context = { role: 'Author' };

    let expected = [
      {
        type: 'role',
        properties: {},
        children: [
          {
            type: 'roleTerm',
            properties: {},
            children: [ 'Author' ]
          }
        ]
      }
    ];

    deepEqual(template.evaluate(context), expected);
  });

  it('should evaluate an arrow expression which looks up something undefined', function() {
    let template = new Arrow({
      type: 'arrow',
      items: { type: 'lookup', path: [ 'role' ] },
      target: [
        { type: 'structure', name: 'role' },
        { type: 'structure', name: 'roleTerm' }
      ]
    });

    let context = {};

    deepEqual(template.evaluate(context), undefined);
  });
});
