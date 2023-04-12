'use strict';

const checker = require('../../checker');
const Vocabulary = require('../vocabulary');

/**
 * @namespace options
 */

/**
 * Check an options structure.
 * @function options.optionsChecker
 * @param {*} value
 * @return {*} The checked value.
 * @throws CheckerError
 */
exports.optionsChecker = checker.oneOf([
  checker.string(),
  checker.arrayOf(checker.string()),
  checker.arrayOf(checker.shape({
    label: checker.string(),
    value: checker.string(),
    note: checker.optional(checker.string())
  }))
]);

/**
 * Return the term or value corresponding to an option value.
 * @function options.getOptionTerm
 * @param options
 * @param value
 * @return {Object|string}
 */
exports.getOptionTerm = function(options, value) {
  if (typeof options === 'string') {
    return Vocabulary.findById(options).then(function(vocabulary) {
      return vocabulary.getTerm(value);
    });
  } else if (Array.isArray(options)) {
    // Find the option that matches the value. It may either be a string or a { label, value } object.
    let option = options.find(function(option) {
      if (typeof option === 'string') {
        return value === option;
      } else {
        return value === option.value;
      }
    });

    // Return the option's value.
    if (option) {
      if (typeof option === 'string') {
        return Promise.resolve(option);
      } else {
        return Promise.resolve(option.value);
      }
    } else {
      return Promise.resolve(undefined);
    }
  }
};

/**
 * Return the corresponding label of an option value.
 * @function options.getOptionLabel
 * @param options
 * @param value
 * @return {string}
 */
exports.getOptionLabel = function(options, value) {
  if (typeof options === 'string') {
    return Vocabulary.findById(options).then(function(vocabulary) {
      let term = vocabulary.getTerm(value);

      if (typeof term === 'object') {
        return term[vocabulary.labelKey];
      } else {
        return term;
      }
    });
  } else if (Array.isArray(options)) {
    // Find the option that matches the value. It may either be a string or a { label, value } object.
    let option = options.find(function(option) {
      if (typeof option === 'string') {
        return value === option;
      } else {
        return value === option.value;
      }
    });

    // Return the option's label, or the option itself if it is just a string.
    if (option) {
      if (typeof option === 'string') {
        return Promise.resolve(option);
      } else {
        return Promise.resolve(option.label);
      }
    } else {
      return Promise.resolve(undefined);
    }
  }
};

/**
 * Given the options property of a form block, return a list of option structures for a JSON API resource object.
 * @function options.getOptionsResourceAttributes
 * @param options
 * @return Array<{ label: string, value: string }>
 */
exports.getOptionsResourceAttributes = function(options) {
  if (typeof options === 'string') {
    return Vocabulary.findById(options).then(function(vocabulary) {
      return vocabulary.options;
    });
  } else if (Array.isArray(options)) {
    return Promise.resolve(options.map(option => {
      if (typeof option === 'string') {
        return { label: option, value: option };
      } else {
        return option;
      }
    }));
  }
};
