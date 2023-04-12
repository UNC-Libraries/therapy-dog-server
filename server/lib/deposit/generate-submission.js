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
const Link = require('./bundle/link');
const Item = require('./bundle/item');
const File = require('./bundle/file');
const Metadata = require('./bundle/metadata');

// metsHdr

function generateMetsHdr(mets) {
  let metsHdr =
  mets
    .element('metsHdr', { CREATEDATE: new Date().toISOString() });

  metsHdr
    .element('agent', { ROLE: 'CREATOR', TYPE: 'OTHER' })
    .element('name')
    .text('CDR Forms');
}

// dmdSec

function generateDmdSec(mets, bundle) {
  bundle.metadata.forEach(function(metadata) {
    if (metadata.type === 'descriptive' && metadata.contents.root.children.length > 0) {
      let dmdSec =
      mets
        .element('dmdSec', { ID: metadata.id });

      let xmlData =
      dmdSec
        .element('mdWrap', { MDTYPE: 'MODS' })
        .element('xmlData');

      metadata.contents.render(xmlData);
    }
  });
}

// amdSec

function generateAmdSec(mets, bundle) {
  let metadata = bundle.metadata.filter(function(node) {
    return node.type === 'access-control';
  });

  if (metadata.length > 0) {
    let amdSec =
    mets
      .element('amdSec');

    metadata.forEach(function(node) {
      let rights =
      amdSec
        .element('rightsMD', { ID: node.id });

      let xmlData =
      rights
        .element('mdWrap', { MDTYPE: 'OTHER' })
        .element('xmlData');

      node.contents.render(xmlData);
    });
  }
}

// fileSec

function generateFileSec(mets, bundle, locations, checksums) {
  let fileGrp =
  mets
    .element('fileSec')
    .element('fileGrp', { ID: 'OBJECTS' });

  bundle.files.forEach(function(file) {
    fileGrp
      .element('file', { CHECKSUM: checksums[file.id], CHECKSUMTYPE: 'MD5', ID: file.id, MIMETYPE: file.mimetype, SIZE: file.size })
      .element('FLocat', { 'xlink:href': locations[file.id], LOCTYPE: 'OTHER', USE: 'STAGE' });
  });
}

// structMap

function generateItem(parent, node) {
  let div =
  parent
    .element('div', { ID: node.id });

  /* istanbul ignore else */
  if (node.type) {
    div.attribute('TYPE', node.type);
  }

  /* istanbul ignore else */
  if (node.label) {
    div.attribute('LABEL', node.label);
  }

  node.children.forEach(function(child) {
    if (child instanceof Item) {
      generateItem(div, child);
    } else if (child instanceof File) {
      div.element('fptr', { FILEID: child.id });
    }
  });

  let metadata = node.children.filter(function(child) {
    return child instanceof Metadata;
  });

  let dmdIds = metadata.filter(function(node) {
    return node.type === 'descriptive' && node.contents.root.children.length > 0;
  }).map(function(node) {
    return node.id;
  });

  let admIds = metadata.filter(function(node) {
    return node.type === 'access-control';
  }).map(function(node) {
    return node.id;
  });

  if (dmdIds.length > 0) {
    div.attribute('DMDID', dmdIds.join(' '));
  }

  if (admIds.length > 0) {
    div.attribute('ADMID', admIds.join(' '));
  }
}

function generateStructMap(mets, bundle) {
  let structMap =
  mets
    .element('structMap');

  bundle.children.forEach(function(child) {
    generateItem(structMap, child);
  });
}

// structLink

function collectSmLinks(bundle) {
  let result = [];

  bundle.items.forEach(function(item) {
    item.children.forEach(function(child) {
      if (child instanceof Link) {
        result.push({ arcrole: child.rel, from: '#' + item.id, to: '#' + child.target.id });
      }
    });
  });

  return result;
}

function generateStructLink(mets, bundle) {
  let smLinks = collectSmLinks(bundle);

  if (smLinks.length > 0) {
    let structMap =
    mets
      .element('structLink');

    smLinks.forEach(function(link) {
      structMap.element('smLink', { 'xlink:arcrole': link.arcrole, 'xlink:from': link.from, 'xlink:to': link.to });
    });
  }
}

/**
 * An object representing the files to be submitted.
 * <p>The key of each property may indicate a file path, the name of an entry in an archive file, or something else, depending on how the submission will be deposited. In our case, {@link submitZip} uses the keys as names for entries in a zip file. The value of each property is either a path to a file on disk or a Buffer.</p>
 * @typedef {Object.<string, string|Buffer>} Submission
 */

/**
 * Generate a METS {@link Submission} for deposit into the CDR.
 * <p>The {@link Submission} will contain a "mets.xml" property with a Buffer containing METS XML, and contents of the {@link File} instances in `bundle` as either paths or Buffers keyed by their {@link File#id id}.</p>
 * @function
 * @name generateSubmission
 * @param {Form} form
 * @param {Bundle} bundle
 * @return {Promise<Submission>}
 */
module.exports = function(form, bundle) {
  // Build a hash of file locations (just the file id right now) by file id.
  // This is where we'd assign staging URLs if we wanted to refer to files outside of the submission proper.
  let fileLocations = bundle.files.reduce(function(obj, file) {
    obj[file.id] = file.id;
    return obj;
  }, {});

  // Build an array of promises which calculate the checksum for each file.
  let checksums = bundle.files.map(function(file) {
    return file.getHashDigest('md5');
  });

  // Calculate all of the checksums, and then proceed with generating METS.
  return Promise.all(checksums)
    .then(function(checksums) {
    // Build a hash of checksums by file id.
      let fileChecksums = bundle.files.reduce(function(obj, file, index) {
        obj[file.id] = checksums[index];
        return obj;
      }, {});

      let mets = Xmlbuilder.create('mets', { encoding: 'utf-8' })
        .attribute('xmlns', 'http://www.loc.gov/METS/')
        .attribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
        .attribute('PROFILE', 'http://cdr.unc.edu/METS/profiles/Simple');

      generateMetsHdr(mets, bundle);
      generateDmdSec(mets, bundle);
      generateAmdSec(mets, bundle);
      generateFileSec(mets, bundle, fileLocations, fileChecksums);
      generateStructMap(mets, bundle);
      generateStructLink(mets, bundle);

      // Build the submission. The name of the METS XML will be "mets.xml", and the rest of the files will be named by their ID.
      let submission = {
        'mets.xml': Buffer.from(mets.end({ pretty: true }))
      };

      bundle.files.forEach(function(file) {
        if (file.isUpload) {
          submission[file.id] = file.contents.path;
        } else {
          submission[file.id] = file.contents;
        }
      });

      return submission;
    });
};
