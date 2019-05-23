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

describe('Compact', function() {
  describe('with lookup nodes', function() {
    let template = new Arrow({
      type: 'structure',
      name: 'mods',
      children: [
        {
          type: 'structure',
          name: 'originInfo',
          children: [
            {
              type: 'structure',
              name: 'dateIssued',
              children: [
                { type: 'lookup', path: ['pubdate'] }
              ]
            },
            {
              type: 'structure',
              name: 'edition',
              children: [
                { type: 'lookup', path: ['version'] }
              ]
            }
          ]
        }
      ]
    });

    it('should remove children with all absent data', function() {
      let context = {};

      let expected = {
        type: 'mods',
        properties: {},
        children: []
      };

      deepEqual(template.evaluate(context), expected);
    });

    it('should consider empty context strings absent data', function() {
      let context = { pubdate: '', version: '' };

      let expected = {
        type: 'mods',
        properties: {},
        children: []
      };

      deepEqual(template.evaluate(context), expected);
    });

    it('should not remove children with both present and absent data', function() {
      let context = { pubdate: '2016' };

      let expected = {
        type: 'mods',
        properties: {},
        children: [
          {
            type: 'originInfo',
            properties: {},
            children: [
              {
                type: 'dateIssued',
                properties: {},
                children: ['2016']
              }
            ]
          }
        ]
      };

      deepEqual(template.evaluate(context), expected);
    });
  });

  describe('with lookup nodes in properties', function() {
    let template = new Arrow({
      type: 'structure',
      name: 'accessControl',
      properties: {
        'xmlns': {
          type: 'string',
          value: 'http://cdr.unc.edu/definitions/acl'
        },
        published: {
          type: 'lookup',
          path: ['published']
        },
        'embargo-until': {
          type: 'lookup',
          path: ['embargo-until']
        }
      }
    });

    it('should remove absent properties, even if they are blank strings', function() {
      let context = { published: '' };

      let expected = {
        type: 'accessControl',
        properties: {
          xmlns: 'http://cdr.unc.edu/definitions/acl'
        },
        children: []
      };

      deepEqual(template.evaluate(context), expected);
    });
  });

  describe('with multiple levels', function() {
    let template = new Arrow({
      type: 'structure',
      name: 'mods',
      children: [
        {
          type: 'structure',
          name: 'originInfo',
          children: [
            {
              type: 'structure',
              name: 'dateIssued',
              children: [
                { type: 'lookup', path: ['pubdate'] }
              ]
            },
            {
              type: 'structure',
              name: 'edition',
              children: [
                { type: 'lookup', path: ['version'] }
              ]
            },
            {
              type: 'structure',
              name: 'publisher',
              children: [
                { type: 'string', value: 'Someone' }
              ]
            }
          ]
        }
      ]
    });

    it('should not remove a structure containing other structures where some descendant lookups are present and some are absent', function() {
      let context = { pubdate: '2016' };

      let expected = {
        type: 'mods',
        properties: {},
        children: [
          {
            type: 'originInfo',
            properties: {},
            children: [
              {
                type: 'dateIssued',
                properties: {},
                children: ['2016']
              },
              {
                type: 'publisher',
                properties: {},
                children: ['Someone']
              }
            ]
          }
        ]
      };

      deepEqual(template.evaluate(context), expected);
    });

    it('should remove a structure containing other structures if none of their descendant lookups are present', function() {
      let context = {};

      let expected = {
        type: 'mods',
        properties: {},
        children: []
      };

      deepEqual(template.evaluate(context), expected);
    });
  });

  it('should remove structures containing only strings and absent data', function() {
    let template = new Arrow({
      type: 'structure',
      name: 'mods',
      children: [
        {
          type: 'structure',
          name: 'name',
          children: [
            {
              type: 'structure',
              name: 'namePart',
              properties: {
                type: { type: 'string', value: 'given' }
              },
              children: [
                { type: 'lookup', path: ['first'] }
              ]
            },
            {
              type: 'structure',
              name: 'role',
              children: [
                {
                  type: 'structure',
                  name: 'roleTerm',
                  children: [
                    { type: 'string', value: 'Author' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    let context = {};

    let expected = {
      type: 'mods',
      properties: {},
      children: []
    };

    deepEqual(template.evaluate(context), expected);
  });

  it('should not remove structures containing only strings', function() {
    let template = new Arrow({
      type: 'structure',
      name: 'mods',
      children: [
        {
          type: 'structure',
          name: 'accessCondition',
          children: [
            { type: 'string', value: 'Some license...' }
          ]
        }
      ]
    });

    let context = {};

    let expected = {
      type: 'mods',
      properties: {},
      children: [
        {
          type: 'accessCondition',
          properties: {},
          children: ['Some license...']
        }
      ]
    };

    deepEqual(template.evaluate(context), expected);
  });

  it('should not remove structures marked keep, even if they contain absent data', function() {
    let template = new Arrow({
      type: 'structure',
      name: 'mods',
      children: [
        {
          type: 'structure',
          name: 'originInfo',
          children: [
            {
              type: 'structure',
              name: 'dateIssued',
              keep: true,
              children: [
                { type: 'lookup', path: ['pubdate'] }
              ]
            }
          ]
        }
      ]
    });

    let context = {};

    let expected = {
      type: 'mods',
      properties: {},
      children: [
        {
          type: 'originInfo',
          properties: {},
          children: [
            {
              type: 'dateIssued',
              properties: {},
              children: []
            }
          ]
        }
      ]
    };

    deepEqual(template.evaluate(context), expected);
  });
});
