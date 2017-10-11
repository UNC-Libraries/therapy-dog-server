'use strict';

const Promise = require('bluebird');
const validator = require('validator');
const he = require('he');
const xssFilters = require('xss-filters');
const Arrow = require('../../arrow');
const checker = require('../../checker');
const findById = require('../utils').findById;
const blockCheckers = require('./block-checkers');
const blockDeserializers = require('./block-deserializers');
const blockSummarizers = require('./block-summarizers');
const blockResourceAttributes = require('./block-resource-attributes');
const config = require('../../../config');

// Define checkers for checking attributes in the Form constructor.

// Bundles
let bundleFileChecker = checker.shape({
  context: checker.optional(checker.string()),
  metadata: checker.optional(checker.arrayOf(checker.string())),
  upload: checker.string()
});

let bundleItemChecker = checker.shape({
  context: checker.optional(checker.string()),
  metadata: checker.optional(checker.arrayOf(checker.string()))
});

let bundleChecker = checker.recordTypes({
  single: checker.shape({
    file: bundleFileChecker
  }),
  aggregate: checker.shape({
    aggregate: checker.optional(bundleItemChecker),
    main: checker.optional(bundleFileChecker),
    supplemental: checker.optional(checker.arrayOf(bundleFileChecker)),
    agreements: checker.optional(checker.arrayOf(checker.string()))
  })
});

// Metadata
let metadataChecker = checker.shape({
  id: checker.string(),
  type: checker.oneOf([
    checker.literal('descriptive'),
    checker.literal('access-control')
  ]),
  model: checker.literal('xml'),
  template: Arrow.expressionCheckers.expression
});

// Notification recipient email expressions
let notificationRecipientEmailChecker = checker.recordTypes({
  string: Arrow.expressionCheckers.string,
  lookup: Arrow.expressionCheckers.lookup
});

// Form
let formChecker = checker.shape({
  destination: checker.string(),
  contact: checker.optional(checker.shape({
    name: checker.string(),
    email: checker.string()
  })),
  title: checker.string(),
  allowDestinationOverride: checker.optional(checker.boolean()),
  addAnother: checker.optional(checker.boolean()),
  addAnotherText: checker.optional(checker.string()),
  submitAsCurrentUser: checker.optional(checker.boolean()),
  sendEmailReceipt: checker.optional(checker.boolean()),
  description: checker.optional(checker.string()),
  notificationRecipientEmails: checker.optional(checker.arrayOf(notificationRecipientEmailChecker)),
  children: checker.arrayOf(blockCheckers.block),
  bundle: bundleChecker,
  metadata: checker.arrayOf(metadataChecker)
});

function mapBlocks(blocks, iterator) {
  return Promise.all(blocks.map(function(block) {
    return iterator(block, (children) => mapBlocks(children, iterator));
  }));
}

function reduceValues(blocks, values, iterator, initial) {
  return Promise.reduce(blocks, function(result, block) {
    return iterator(result, block, values[block.key], (children, value, initial) => reduceValues(children, value, iterator, initial));
  }, initial);
}

/**
 * Santizes user input. Note: validator library doesn't allow method chaining.
 * Combination of 3 libs: validator, xssFilters and he.
 * Removes hidden unicode chars, except newlines. Prevents XSS attack,
 * removes 0 width chars, and converts most HTML special chars to their correct browser display value.
 * @param value
 * @returns {String}
 */
function validateValue(value) {
  let specialChars = '\[\\u200B-\\u200D\\uFEFF\\\]'; // zero width unicode characters

  let trimmed = validator.trim(value);
  let stripped = validator.stripLow(trimmed);
  let removeBlacklisted = validator.blacklist(stripped, specialChars);

  let escaped = xssFilters.inHTMLData(removeBlacklisted);

  if (!/&gt;|&lt;/.test(escaped)) {
    return he.decode(escaped);
  }

  return escaped;
}

class Form {
  /**
    * @param {String} id
    * @param {Object} attributes
    */
  constructor(id, attributes) {
    this.id = id;
    this.attributes = formChecker(attributes);
  }

  /**
   * @type {String}
   */
  get destination() {
    return this.attributes.destination;
  }

  /**
   * @param {String} destination
   */
  set destination(destination) {
    this.attributes.destination = destination;
  }

   /**
   * @type {Boolean}
   */
  get allowDestinationOverride() {
    return this.attributes.allowDestinationOverride;
  }

   /**
   * @type {Boolean}
   */
  get addAnother() {
    return this.attributes.addAnother;
  }

   /**
   * @type {String}
   */
  get addAnotherText() {
    return this.attributes.addAnotherText;
  }

   /**
   * @type {Boolean}
   */
  get submitAsCurrentUser() {
    return this.attributes.submitAsCurrentUser;
  }

  /**
   * @type {Boolean}
   */
  get sendEmailReceipt() {
    return this.attributes.sendEmailReceipt;
  }

  /**
   * @type {Object}
   */
  get contact() {
    return this.attributes.contact;
  }

  /**
   * @type {Array<Object>}
   */
  get notificationRecipientEmails() {
    return this.attributes.notificationRecipientEmails;
  }

  /**
   * @type {String}
   */
  get title() {
    return this.attributes.title;
  }

  /**
   * @type {String}
   */
  get description() {
    return this.attributes.description;
  }

  /**
   * @type {Array}
   */
  get children() {
    return this.attributes.children;
  }

  /**
   * @type {Object}
   */
  get bundle() {
    return this.attributes.bundle;
  }

  /**
   * @type {Array<Object>}
  */
  get metadata() {
    return this.attributes.metadata;
  }

  /**
   * Return a JSON API resource object representing this form.
   * @return {Promise<Object>}
   */
  getResourceObject() {
    let options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    if (options.children) {
      return mapBlocks(this.children, function(block, mapChildren) {
        return blockResourceAttributes[block.type](block, mapChildren);
      })
      .then((children) => {
        return {
          type: 'form',
          id: this.id,
          attributes: {
            title: this.title,
            allowDestinationOverride: this.allowDestinationOverride,
            addAnother: this.addAnother,
            addAnotherText: this.addAnotherText,
            sendEmailReceipt: this.sendEmailReceipt,
            description: this.description,
            contact: this.contact,
            children: children
          }
        };
      });
    } else {
      return {
        type: 'form',
        id: this.id,
        attributes: {
          title: this.title,
          allowDestinationOverride: this.allowDestinationOverride,
          addAnother: this.addAnother,
          addAnotherText: this.addAnotherText,
          sendEmailReceipt: this.sendEmailReceipt,
          description: this.description,
          contact: this.contact
        }
      };
    }
  }

  /**
   * Transform the input so that:
   * <ul>
   *   <li>it is in the shape defined by the form,</li>
   *   <li>values for text and date blocks are strings,</li>
   *   <li>references to vocabulary terms are replaced by the terms themselves, and</li>
   *   <li>references to Upload instances are replaced with the instances themselves.</li>
   * </ul>
   * @param {Object} values
   * @return {Promise}
   */
  deserializeInput(input) {
    return reduceValues(this.children, input, function(result, block, value, reduceChildren) {
      return Promise.resolve(blockDeserializers[block.type](block, value, reduceChildren)).then(deserialized => Object.assign(result, { [block.key]: deserialized }));
    }, {});
  }

  /**
   * Transform similarly to {@link Form#deserializeInput}, except that references to vocabulary terms are replaced by their labels, references to Uploads are replace with the uploads' names, and the output is flattened into arrays. This is used in mailers to provide a human-readable description of form input.
   * @param {Object} input
   * @return {Promise}
   */
  summarizeInput(input) {
    return reduceValues(this.children, input, function(result, block, value, reduceChildren) {
      return Promise.resolve(blockSummarizers[block.type](block, value, reduceChildren)).then(summary => result.concat(summary));
    }, []);
  }

  /**
   * Sanitize form information submitted by end users
   * @param input
   * @returns {Object}
   */
  sanitizeInput(input) {
    let skipKeys = ['agreement', 'virtual:depositor-email'];
    let allKeys = Object.keys(input);

    allKeys.forEach((key) => {
      if (skipKeys.indexOf(key) !== -1) {
        return;
      }

      if (typeof input[key] === 'object') {
        let itemKeys = Object.keys(input[key]);

        itemKeys.forEach((k) => {
          if (typeof input[key][k] === 'object') {
            let subKeys = Object.keys(input[key][k]);

            subKeys.forEach((q) => {
              input[key][k][q] = validateValue(input[key][k][q]);
            });
          } else {
            input[key][k] = validateValue(input[key][k]);
          }
        });
      } else if (typeof input[key] === 'string') {
        input[key] = validateValue(input[key]);
      }
    });

    return input;
  }

  /**
   * Find the form with the given id.
   * @param {String} id
   * @return {Promise<Form>}
   */
  static findById(id) {
    return findById(config.FORMS_DIRECTORY, this, id);
  }
}

module.exports = Form;
