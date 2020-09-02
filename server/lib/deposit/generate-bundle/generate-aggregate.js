'use strict';

const Arrow = require('../../arrow');
const XML = require('../../arrow/models/xml');
const Item = require('../bundle/item');
const File = require('../bundle/file');
const Link = require('../bundle/link');
const Metadata = require('../bundle/metadata');
const Bundle = require('../bundle');

function toArray(array) {
  if (Array.isArray(array)) {
    return array;
  } else if (array === undefined) {
    return [];
  } else {
    return [ array ];
  }
}

function generateFileItems(itemSpec, metadataSpecs, values) {
  let contexts;
  if (itemSpec.context) {
    contexts = toArray(values[itemSpec.context]);
  } else {
    contexts = toArray(values);
  }

  return contexts.reduce(function(result, context) {
    let uploads = toArray(context[itemSpec.upload]);

    let items = uploads.map(function(upload) {
      let file = new File(upload, {});

      let metadata;
      if (itemSpec.metadata) {
        metadata = itemSpec.metadata.map(function(id) {
          let spec = metadataSpecs.find(m => m.id === id);
          let root = new Arrow(spec.template).evaluate(context);
          let xml = new XML(root);

          return new Metadata(xml, { type: spec.type });
        });
      } else {
        metadata = [];
      }

      return new Item([ file ].concat(metadata), { type: 'File', label: upload.name });
    });

    return result.concat(items);
  }, []);
}

function generateOneFileItem(itemSpec, metadataSpecs, values) {
  let items = generateFileItems(itemSpec, metadataSpecs, values);

  if (items.length !== 1) {
    throw new Error('Expected item spec to generate exactly one item, instead got ' + items.length);
  }

  return items[0];
}

function generateAgreementFileItem(agreements, values, depositorSignature) {
  let currentDate = new Date();
  let currentMonth = currentDate.getUTCMonth() + 1;
  let currentDay = currentDate.getUTCDate();
  let currentYear = currentDate.getUTCFullYear();

  let contents = new Buffer(agreements.map(function(key) {
    let agreement = values[key];
    return `${agreement.name}\n${agreement.uri}\n${agreement.prompt}\n${currentMonth}/${currentDay}/${currentYear}\n${depositorSignature}\n`;
  }).join('\n'));

  let file = new File(contents, { mimetype: 'text/plain' });

  let xml = new XML({
    type: 'acl:accessControl',
    properties: {
      'xmlns:acl': 'http://cdr.unc.edu/definitions/acl',
      'acl:published': 'false',
      'acl:inherit': 'false'
    },
    children: []
  });
  let metadata = new Metadata(xml, { type: 'access-control' });

  return new Item([ file, metadata ], { type: 'File', label: 'agreements.txt' });
}

/**
 * Generate a bundle containing an 'Aggregate Work' item.
 * <p>The item will contain a main file and optional supplemental files, each optionally with metadata, and an optional agreement record. The aggregate item is linked to the main item via the CDR defaultWebObject relationship.</p>
 * @function
 * @name generateAggregate
 * @param {Form} form
 * @param {Object} values
 * @return {Bundle}
 */
module.exports = function(form, values, depositorSignature) {
  let children = [];
  if (form.bundle.supplemental) {
    let supplemental = form.bundle.supplemental.reduce(function(result, itemSpec) {
      return result.concat(generateFileItems(itemSpec, form.metadata, values));
    }, []);
    children = children.concat(supplemental);
  }

  let main = generateOneFileItem(form.bundle.main, form.metadata, values);

  let link = new Link(main, 'http://cdr.unc.edu/definitions/1.0/base-model.xml#defaultWebObject');

  let agreement;
  if (form.bundle.agreements) {
    agreement = generateAgreementFileItem(form.bundle.agreements, values, depositorSignature);
  } else {
    agreement = [];
  }

  let metadata;
  if (form.bundle.aggregate && form.bundle.aggregate.metadata) {
    let context;
    if (form.bundle.aggregate.context) {
      context = values[form.bundle.aggregate.context];
    } else {
      context = values;
    }

    metadata = form.bundle.aggregate.metadata.map(function(id) {
      let spec = form.metadata.find(m => m.id === id);
      let root = new Arrow(spec.template).evaluate(context);
      let xml = new XML(root);

      return new Metadata(xml, { type: spec.type });
    });
  } else {
    metadata = [];
  }

  let aggregate = new Item([].concat(main).concat(children).concat(link).concat(agreement).concat(metadata), { type: 'Aggregate Work', label: 'Aggregate Work' });

  return new Bundle([ aggregate ], {});
};
