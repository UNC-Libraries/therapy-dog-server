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
const xpath = require('xpath');
const DOMParser = require('xmldom').DOMParser;
const Form = require('../../lib/models/form');
const File = require('../../lib/deposit/bundle/file');
const generateSubmission = require('../../lib/deposit/generate-submission');
const generateBundle = require('../../lib/deposit/generate-bundle');
const buildTestUpload = require('../test-helpers').buildTestUpload;

const select = xpath.useNamespaces({
  mets: 'http://www.loc.gov/METS/',
  mods: 'http://www.loc.gov/mods/v3',
  xlink: 'http://www.w3.org/1999/xlink',
  acl: 'http://cdr.unc.edu/definitions/acl'
});
const select1 = function(e, doc) { return select(e, doc, true); };

describe('Submission generation', function() {
  describe('using the "single" bundle type', function() {
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
          metadata: [ 'description', 'unpublished' ]
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
            properties: {
              xmlns: { type: 'string', value: 'http://www.loc.gov/mods/v3' }
            },
            children: [
              {
                type: 'arrow',
                items: { type: 'lookup', path: [ 'title' ] },
                target: [
                  { type: 'structure', name: 'titleInfo' },
                  { type: 'structure', name: 'title' }
                ]
              }
            ]
          }
        },
        {
          id: 'unpublished',
          type: 'access-control',
          model: 'xml',
          template: {
            type: 'structure',
            name: 'accessControl',
            properties: {
              xmlns: { type: 'string', value: 'http://cdr.unc.edu/definitions/acl' },
              published: { type: 'string', value: 'false' }
            }
          }
        }
      ]
    });

    let buffer = Buffer.from('lorem ipsum');
    let thesis = buildTestUpload('thesis.pdf', 'application/pdf', buffer);

    let values = {
      thesis: thesis,
      title: 'My Thesis'
    };

    let bundle = generateBundle(form, values);
    let submission = generateSubmission(form, bundle);
    let doc = submission.then(function(submission) {
      return new DOMParser().parseFromString(submission['mets.xml'].toString());
    });

    let emptyValues = {
      thesis: thesis
    };

    let bundleEmpty = generateBundle(form, emptyValues);
    let submissionEmpty = generateSubmission(form, bundleEmpty);
    let docEmpty = submissionEmpty.then(function(submission) {
      return new DOMParser().parseFromString(submission['mets.xml'].toString());
    });

    it('should contain METS XML as a Buffer, and the upload\'s path', function() {
      let bundleFile = bundle.files[0];

      return submission.then(function(submission) {
        assert.ok(submission['mets.xml'] instanceof Buffer);
        assert.equal(submission[bundleFile.id], bundleFile.contents.path);
      });
    });

    it('should generate a mets element with the correct profile', function() {
      return doc.then(function(doc) {
        let mets = select1('/mets:mets', doc);
        assert.equal(mets.getAttribute('PROFILE'), 'http://cdr.unc.edu/METS/profiles/Simple');
      });
    });

    it('should generate a metsHdr element', function() {
      return doc.then(function(doc) {
        let metsHdr = select1('/mets:mets/mets:metsHdr', doc);
        assert.ok(metsHdr);
        assert.ok(metsHdr.getAttribute('CREATEDATE'));

        let agent = select1('mets:agent', metsHdr);
        assert.ok(agent);
        assert.ok(agent.getAttribute('ROLE'));
        assert.ok(agent.getAttribute('TYPE'));

        let name = select1('mets:name', agent);
        assert.ok(name);
      });
    });

    it('should generate a dmdSec element', function() {
      let bundleMetadata = bundle.metadata.find(m => m.type === 'descriptive');

      return doc.then(function(doc) {
        let dmdSec = select1('/mets:mets/mets:dmdSec', doc);
        assert.ok(dmdSec);
        assert.equal(dmdSec.getAttribute('ID'), bundleMetadata.id);

        let mdWrap = select1('mets:mdWrap', dmdSec);
        assert.ok(mdWrap);
        assert.equal(mdWrap.getAttribute('MDTYPE'), 'MODS');

        let mods = select1('mets:xmlData/mods:mods', mdWrap);
        assert.ok(mods);

        let title = select1('mods:titleInfo/mods:title/text()', mods);
        assert.ok(title);
        assert.equal(title, 'My Thesis');
      });
    });

    it('should not generate an dmdSec element if MODS is empty', function() {
      return docEmpty.then(function(doc) {
        let dmdSec = select1('/mets:mets/mets:dmdSec', doc);
        assert.ok(!dmdSec);
      });
    });

    it('should generate an amdSec element', function() {
      let bundleMetadata = bundle.metadata.find(m => m.type === 'access-control');

      return doc.then(function(doc) {
        let amdSec = select1('/mets:mets/mets:amdSec', doc);
        assert.ok(amdSec);

        let rightsMD = select1('mets:rightsMD', amdSec);
        assert.equal(rightsMD.getAttribute('ID'), bundleMetadata.id);

        let mdWrap = select1('mets:mdWrap', rightsMD);
        assert.ok(mdWrap);
        assert.equal(mdWrap.getAttribute('MDTYPE'), 'OTHER');

        let accessControl = select1('mets:xmlData/acl:accessControl', mdWrap);
        assert.ok(accessControl);
        assert.equal(accessControl.getAttribute('published'), 'false');
      });
    });

    it('should generate a file element', function() {
      let bundleFile = bundle.files[0];

      return doc.then(function(doc) {
        let file = select1('/mets:mets/mets:fileSec/mets:fileGrp/mets:file', doc);
        assert.ok(file);
        assert.equal(file.getAttribute('ID'), bundleFile.id);
        assert.equal(file.getAttribute('MIMETYPE'), 'application/pdf');
        assert.equal(file.getAttribute('CHECKSUM'), '80a751fde577028640c419000e33eba6');
        assert.equal(file.getAttribute('CHECKSUMTYPE'), 'MD5');
        assert.equal(file.getAttribute('SIZE'), '11');

        let flocat = select1('mets:FLocat', file);
        assert.ok(flocat);
        assert.equal(select1('@xlink:href', flocat).value, bundleFile.id);
      });
    });

    it('should generate a div element linked to the file element and metadata elements', function() {
      let bundleItem = bundle.items[0];
      let bundleFile = bundle.files[0];
      let bundleDescriptiveMetadata = bundle.metadata.find(m => m.type === 'descriptive');
      let bundleAccessControlMetadata = bundle.metadata.find(m => m.type === 'access-control');

      return doc.then(function(doc) {
        let div = select1('/mets:mets/mets:structMap/mets:div', doc);
        assert.ok(div);
        assert.equal(div.getAttribute('ID'), bundleItem.id);
        assert.equal(div.getAttribute('TYPE'), 'File');
        assert.equal(div.getAttribute('LABEL'), 'thesis.pdf');
        assert.equal(div.getAttribute('DMDID'), bundleDescriptiveMetadata.id);
        assert.equal(div.getAttribute('ADMID'), bundleAccessControlMetadata.id);

        let fptr = select1('mets:fptr', div);
        assert.ok(fptr);
        assert.equal(fptr.getAttribute('FILEID'), bundleFile.id);
      });
    });

    it('should generate sections in order', function() {
      return doc.then(function(doc) {
        let sections = select('/mets:mets/*', doc);
        let names = sections.map(function(s) { return s.tagName; });

        assert.deepEqual([ 'metsHdr', 'dmdSec', 'amdSec', 'fileSec', 'structMap' ], names);
      });
    });
  });

  describe('with the "aggregate" bundle type', function() {
    let form = new Form('test', {
      destination: 'uuid:1234',
      title: 'Test',
      children: [
        { type: 'text', key: 'title' },
        { type: 'file', key: 'thesis' },
        { type: 'file', key: 'supplemental', multiple: true },
        { type: 'agreement', key: 'agreement', name: 'Agreement', uri: 'http://example.com/agreement', prompt: 'You agree to the agreement.' }
      ],
      bundle: {
        type: 'aggregate',
        main: {
          upload: 'thesis'
        },
        supplemental: [
          {
            upload: 'supplemental'
          }
        ],
        agreements: [
          'agreement'
        ]
      },
      metadata: []
    });

    let buffer = Buffer.from('lorem ipsum');
    let thesis = buildTestUpload('thesis.pdf', 'application/pdf', buffer);
    let dataset = buildTestUpload('dataset.csv', 'text/csv', buffer);
    let appendix = buildTestUpload('appendix.pdf', 'application/pdf', buffer);

    let values = {
      thesis: thesis,
      supplemental: [ dataset, appendix ],
      agreement: true
    };

    let bundle = generateBundle(form, values);
    let submission = generateSubmission(form, bundle);
    let doc = submission.then(function(submission) {
      return new DOMParser().parseFromString(submission['mets.xml'].toString());
    });

    it('should generate a structLink element with a link from the Aggregate Work div to the File div', function() {
      let bundleAggregateItem = bundle.children[0];
      let bundleMainItem = bundle.items.find(i => i.label === 'thesis.pdf');

      return doc.then(function(doc) {
        let smLink = select1('/mets:mets/mets:structLink/mets:smLink', doc);
        assert.ok(smLink);
        assert.equal(select1('@xlink:arcrole', smLink).value, 'http://cdr.unc.edu/definitions/1.0/base-model.xml#defaultWebObject');
        assert.equal(select1('@xlink:from', smLink).value, '#' + bundleAggregateItem.id);
        assert.equal(select1('@xlink:to', smLink).value, '#' + bundleMainItem.id);
      });
    });

    it('should generate a div element for the aggregate item', function() {
      return doc.then(function(doc) {
        let aggregateDiv = select1('/mets:mets/mets:structMap/mets:div', doc);
        assert.ok(aggregateDiv);
        assert.equal(aggregateDiv.getAttribute('TYPE'), 'Aggregate Work');

        let fileDivs = select('mets:div', aggregateDiv);
        assert.equal(fileDivs.length, 4);
        assert.ok(fileDivs.find(d => d.getAttribute('LABEL') === 'thesis.pdf' && d.getAttribute('TYPE') === 'File'), 'should have a div for thesis.pdf');
        assert.ok(fileDivs.find(d => d.getAttribute('LABEL') === 'dataset.csv' && d.getAttribute('TYPE') === 'File'), 'should have a div for dataset.csv');
        assert.ok(fileDivs.find(d => d.getAttribute('LABEL') === 'appendix.pdf' && d.getAttribute('TYPE') === 'File'), 'should have a div for appendix.pdf');
        assert.ok(fileDivs.find(d => d.getAttribute('LABEL') === 'agreements.txt' && d.getAttribute('TYPE') === 'File'), 'should have a div for agreements.txt');
      });
    });

    it('should contain the agreement record as a buffer', function() {
      let agreementsFile = bundle.items.find(i => i.label === 'agreements.txt').children.find(c => c instanceof File);

      return submission.then(function(submission) {
        assert.ok(submission[agreementsFile.id] instanceof Buffer, 'should have a Buffer for agreements.txt');
      });
    });
  });
});
