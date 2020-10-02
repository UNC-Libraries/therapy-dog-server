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

const Xmlbuilder = require('xmlbuilder');
const XML = require('../../lib/arrow/models/xml');
const equal = require('assert').equal;

describe('XML', function() {
  it('should render elements, attributes, and text', function() {
    let root = {
      type: 'mods',
      properties: {},
      children: [
        {
          type: 'name',
          properties: { type: 'personal' },
          children: [
            {
              type: 'namePart',
              properties: {},
              children: [
                {
                  type: '@type',
                  properties: {},
                  children: [ 'given' ]
                },
                'Someone',
                ' ',
                'Middle'
              ]
            }
          ]
        }
      ]
    };

    let xml = new XML(root);

    equal(xml.render().toString(), '<mods><name type="personal"><namePart type="given">Someone Middle</namePart></name></mods>');
  });

  it('should render using an Xmlbuilder object if given', function() {
    let root = {
      type: 'mods',
      properties: {},
      children: [
        {
          type: 'note',
          properties: {},
          children: [ 'This is a thing' ]
        }
      ]
    };

    let xml = new XML(root);

    let builder = Xmlbuilder.create('xmlData', { encoding: 'utf-8' });
    xml.render(builder);

    equal(builder.toString(), '<xmlData><mods><note>This is a thing</note></mods></xmlData>');
  });

  it('should render number data values as strings', function() {
    let root = {
      type: 'values',
      properties: {
        property: 123
      },
      children: [
        123,
        {
          type: '@childAttrWithChildren',
          properties: {},
          children: [ 123 ]
        },
        {
          type: '@childAttrWithValueProperty',
          properties: {
            value: 123
          },
          children: []
        }
      ]
    };

    let xml = new XML(root);

    equal(xml.render().toString(), '<values property="123" childAttrWithChildren="123" childAttrWithValueProperty="123">123</values>');
  });

  it('should render object data values as strings', function() {
    let root = {
      type: 'values',
      properties: {
        property: { a: 1 }
      },
      children: [
        { a: 1 },
        {
          type: '@childAttrWithChildren',
          properties: {},
          children: [ { a: 1 } ]
        },
        {
          type: '@childAttrWithValueProperty',
          properties: {
            value: { a: 1 }
          },
          children: []
        }
      ]
    };

    let xml = new XML(root);

    equal(xml.render().toString(), '<values property="[object Object]" childAttrWithChildren="[object Object]" childAttrWithValueProperty="[object Object]"><a>1</a>[object Object]</values>');
  });
});
