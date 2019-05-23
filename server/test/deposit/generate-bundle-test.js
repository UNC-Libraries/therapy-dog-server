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
const generateBundle = require('../../lib/deposit/generate-bundle');
const Link = require('../../lib/deposit/bundle/link');
const Metadata = require('../../lib/deposit/bundle/metadata');
const File = require('../../lib/deposit/bundle/file');
const buildTestUpload = require('../test-helpers').buildTestUpload;

describe('Bundle generation', function() {
  describe('using the "single" type', function() {
    let form = new Form('test', {
      destination: 'uuid:1234',
      title: 'Test',
      children: [
        { type: 'text', key: 'title' },
        { type: 'file', key: 'thesis' }
      ],
      bundle: {
        type: 'single',
        file: {
          upload: 'thesis',
          metadata: ['description']
        }
      },
      metadata: [
        {
          id: 'description',
          type: 'descriptive',
          model: 'xml',
          template: {
            type: 'structure',
            name: 'mods',
            children: [
              {
                type: 'arrow',
                items: { type: 'lookup', path: ['title'] },
                target: [
                  { type: 'structure', name: 'titleInfo' },
                  { type: 'structure', name: 'title' }
                ]
              }
            ]
          }
        }
      ]
    });

    let buffer = new Buffer('lorem ipsum');
    let thesis = buildTestUpload('thesis.pdf', 'application/pdf', buffer);

    let values = {
      title: 'My Thesis',
      thesis: thesis
    };

    let bundle = generateBundle(form, values);

    it('should generate the correct number of items, files, metadata', function() {
      assert.equal(bundle.items.length, 1);
      assert.equal(bundle.files.length, 1);
      assert.equal(bundle.metadata.length, 1);
    });

    it('should have a "File" item at the root', function() {
      let item = bundle.children[0];
      assert.equal(item.label, 'thesis.pdf');
      assert.equal(item.type, 'File');
    });

    it('should make the properties from the upload available on the file', function() {
      let file = bundle.files[0];
      assert.equal(file.name, 'thesis.pdf');
      assert.equal(file.mimetype, 'application/pdf');
      assert.equal(file.contents, thesis);
      assert.equal(file.size, buffer.length);
    });

    it('should generate metadata for the item', function() {
      let item = bundle.children[0];
      let metadata = item.children.find(i => i instanceof Metadata);
      assert.equal(metadata.type, 'descriptive');
      assert.equal(metadata.contents.render().toString(), '<mods><titleInfo><title>My Thesis</title></titleInfo></mods>');
    });
  });

  describe('using the "single" type with a context', function() {
    let form = new Form('test', {
      destination: 'uuid:1234',
      title: 'Test',
      children: [
        {
          type: 'section',
          key: 'stuff',
          children: [
            { type: 'text', key: 'title' },
            { type: 'file', key: 'thesis' }
          ]
        }
      ],
      bundle: {
        type: 'single',
        file: {
          context: 'stuff',
          upload: 'thesis',
          metadata: ['description']
        }
      },
      metadata: [
        {
          id: 'description',
          type: 'descriptive',
          model: 'xml',
          template: {
            type: 'structure',
            name: 'mods',
            children: [
              {
                type: 'arrow',
                items: { type: 'lookup', path: ['title'] },
                target: [
                  { type: 'structure', name: 'titleInfo' },
                  { type: 'structure', name: 'title' }
                ]
              }
            ]
          }
        }
      ]
    });

    let buffer = new Buffer('lorem ipsum');
    let thesis = buildTestUpload('thesis.pdf', 'application/pdf', buffer);

    let values = {
      stuff: {
        title: 'My Thesis',
        thesis: thesis
      }
    };

    let bundle = generateBundle(form, values);

    it('should generate the correct number of items, files, metadata', function() {
      assert.equal(bundle.items.length, 1);
      assert.equal(bundle.files.length, 1);
      assert.equal(bundle.metadata.length, 1);
    });

    it('should have a "File" item at the root', function() {
      let item = bundle.children[0];
      assert.equal(item.label, 'thesis.pdf');
      assert.equal(item.type, 'File');
    });

    it('should make the properties from the upload available on the file', function() {
      let file = bundle.files[0];
      assert.equal(file.name, 'thesis.pdf');
      assert.equal(file.mimetype, 'application/pdf');
      assert.equal(file.contents, thesis);
      assert.equal(file.size, buffer.length);
    });

    it('should generate metadata for the item', function() {
      let item = bundle.children[0];
      let metadata = item.children.find(i => i instanceof Metadata);
      assert.equal(metadata.type, 'descriptive');
      assert.equal(metadata.contents.render().toString(), '<mods><titleInfo><title>My Thesis</title></titleInfo></mods>');
    });
  });

  describe('using the "aggregate" type', function() {
    let form = new Form('test', {
      destination: 'uuid:1234',
      title: 'Test',
      children: [
        {
          type: 'section',
          key: 'info',
          children: [
            { type: 'text', key: 'title' }
          ]
        },
        { type: 'file', key: 'thesis' },
        { type: 'file', key: 'supplemental', multiple: true }
      ],
      bundle: {
        type: 'aggregate',
        aggregate: {
          context: 'info',
          metadata: ['description']
        },
        main: {
          upload: 'thesis'
        },
        supplemental: [
          {
            upload: 'supplemental'
          }
        ]
      },
      metadata: [
        {
          id: 'description',
          type: 'descriptive',
          model: 'xml',
          template: {
            type: 'structure',
            name: 'mods',
            children: [
              {
                type: 'arrow',
                items: { type: 'lookup', path: ['title'] },
                target: [
                  { type: 'structure', name: 'titleInfo' },
                  { type: 'structure', name: 'title' }
                ]
              }
            ]
          }
        }
      ]
    });

    let buffer = new Buffer('lorem ipsum');
    let thesis = buildTestUpload('thesis.pdf', 'application/pdf', buffer);
    let dataset = buildTestUpload('dataset.csv', 'text/csv', buffer);
    let appendix = buildTestUpload('appendix.pdf', 'application/pdf', buffer);

    let values = {
      info: {
        title: 'My Thesis'
      },
      thesis: thesis,
      supplemental: [dataset, appendix]
    };

    let bundle = generateBundle(form, values);

    it('should generate the correct number of items, files, metadata', function() {
      assert.equal(bundle.items.length, 4);
      assert.equal(bundle.files.length, 3);
      assert.equal(bundle.metadata.length, 1);
    });

    it('should have an "Aggregate Work" item at the root', function() {
      let aggregate = bundle.children[0];
      assert.equal(aggregate.type, 'Aggregate Work');
      assert.equal(aggregate.label, 'Aggregate Work');
    });

    it('should have "File" items under the "Aggregate Work" item', function() {
      let aggregate = bundle.children[0];
      assert.ok(aggregate.children.find(i => i.type === 'File' && i.label === 'thesis.pdf'));
      assert.ok(aggregate.children.find(i => i.type === 'File' && i.label === 'dataset.csv'));
      assert.ok(aggregate.children.find(i => i.type === 'File' && i.label === 'appendix.pdf'));
    });

    it('should have a link from the "Aggregate Work" item to the main "File" item', function() {
      let aggregate = bundle.children[0];
      let main = aggregate.children.find(i => i.label === 'thesis.pdf');
      let link = aggregate.children.find(i => i instanceof Link);
      assert.equal(link.rel, 'http://cdr.unc.edu/definitions/1.0/base-model.xml#defaultWebObject');
      assert.deepEqual(link.target, main);
    });

    it('should generate metadata for the "Aggregate Work" item', function() {
      let aggregate = bundle.children[0];
      let metadata = aggregate.children.find(i => i instanceof Metadata);
      assert.equal(metadata.type, 'descriptive');
      assert.equal(metadata.contents.render().toString(), '<mods><titleInfo><title>My Thesis</title></titleInfo></mods>');
    });
  });

  describe('using the "aggregate" type with supplemental files and metadata in a section', function() {
    let form = new Form('test', {
      destination: 'uuid:1234',
      title: 'Test',
      children: [
        { type: 'text', key: 'title' },
        { type: 'file', key: 'thesis' },
        {
          type: 'section',
          key: 'supplemental',
          children: [
            { type: 'file', key: 'file' },
            { type: 'text', key: 'abstract' }
          ]
        }
      ],
      bundle: {
        type: 'aggregate',
        aggregate: {
          metadata: ['aggregate']
        },
        main: {
          upload: 'thesis'
        },
        supplemental: [
          {
            context: 'supplemental',
            upload: 'file',
            metadata: ['supplemental']
          }
        ]
      },
      metadata: [
        {
          id: 'aggregate',
          type: 'descriptive',
          model: 'xml',
          template: {
            type: 'structure',
            name: 'mods',
            children: [
              {
                type: 'arrow',
                items: { type: 'lookup', path: ['title'] },
                target: [
                  { type: 'structure', name: 'titleInfo' },
                  { type: 'structure', name: 'title' }
                ]
              }
            ]
          }
        },
        {
          id: 'supplemental',
          type: 'descriptive',
          model: 'xml',
          template: {
            type: 'structure',
            name: 'mods',
            children: [
              {
                type: 'arrow',
                items: { type: 'lookup', path: ['abstract'] },
                target: [
                  { type: 'structure', name: 'abstract' }
                ]
              }
            ]
          }
        }
      ]
    });

    let buffer = new Buffer('lorem ipsum');
    let thesis = buildTestUpload('thesis.pdf', 'application/pdf', buffer);
    let dataset = buildTestUpload('dataset.csv', 'text/csv', buffer);
    let appendix = buildTestUpload('appendix.pdf', 'application/pdf', buffer);

    let values = {
      title: 'My Thesis',
      thesis: thesis,
      supplemental: [
        { abstract: 'Dataset', file: dataset },
        { abstract: 'Appendix', file: appendix }
      ]
    };

    let bundle = generateBundle(form, values);

    it('should generate the correct number of items, files, metadata', function() {
      assert.equal(bundle.items.length, 4);
      assert.equal(bundle.files.length, 3);
      assert.equal(bundle.metadata.length, 3);
    });

    it('should generate metadata for the supplemental items', function() {
      let aggregate = bundle.children[0];

      let item, metadata;

      item = aggregate.children.find(i => i.type === 'File' && i.label === 'dataset.csv');
      metadata = item.children.find(i => i instanceof Metadata);
      assert.equal(metadata.contents.render().toString(), '<mods><abstract>Dataset</abstract></mods>');
      assert.equal(metadata.type, 'descriptive');

      item = aggregate.children.find(i => i.type === 'File' && i.label === 'appendix.pdf');
      metadata = item.children.find(i => i instanceof Metadata);
      assert.equal(metadata.contents.render().toString(), '<mods><abstract>Appendix</abstract></mods>');
      assert.equal(metadata.type, 'descriptive');
    });
  });

  describe('using the "aggregate" type with agreements', function() {
    let form = new Form('test', {
      destination: 'uuid:1234',
      title: 'Test',
      children: [
        { type: 'file', key: 'thesis' },
        {
          type: 'agreement',
          key: 'agreement',
          name: 'Deposit Agreement',
          uri: 'http://example.com/agreement',
          prompt: 'I agree to the terms.'
        }
      ],
      bundle: {
        type: 'aggregate',
        main: {
          upload: 'thesis'
        },
        agreements: ['agreement']
      },
      metadata: []
    });

    let buffer = new Buffer('lorem ipsum');
    let thesis = buildTestUpload('thesis.pdf', 'application/pdf', buffer);

    let values = {
      thesis: thesis,
      agreement: {
        name: 'Deposit Agreement',
        uri: 'http://example.com/agreement',
        prompt: 'I agree to the terms.'
      }
    };

    let bundle = generateBundle(form, values, 'uncUser');

    it('should generate the correct number of items, files, metadata', function() {
      assert.equal(bundle.items.length, 3);
      assert.equal(bundle.files.length, 2);
      assert.equal(bundle.metadata.length, 1);
    });

    it('should generate a file containing a record of the agreements', function() {
      let currentDate = new Date();
      let currentMonth = currentDate.getUTCMonth() + 1;
      let currentDay = currentDate.getUTCDate();
      let currentYear = currentDate.getUTCFullYear();
      let formattedDate = `${currentMonth}/${currentDay}/${currentYear}`;

      let aggregate = bundle.children[0];
      let item = aggregate.children.find(i => i.type === 'File' && i.label === 'agreements.txt');
      let file = item.children.find(i => i instanceof File);

      assert.equal(file.contents.toString(), 'Deposit Agreement\nhttp://example.com/agreement\nI agree to the terms.\n' + formattedDate + '\nuncUser\n');
    });

    it('should generate access control metadata for the agreement record', function() {
      let item = bundle.items.find(i => i.label === 'agreements.txt');
      let metadata = item.children.find(i => i instanceof Metadata);

      assert.equal(metadata.type, 'access-control');
    });
  });
});
