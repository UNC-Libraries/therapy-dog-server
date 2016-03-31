'use strict';

const path = require('path');
const glob = require('glob');
const VocabularyNotFoundError = require('../errors').VocabularyNotFoundError;
const config = require('../config');

const VOCABULARIES = {};

if (config.get('VOCABULARIES_DIRECTORY')) {
  glob(path.join(config.get('VOCABULARIES_DIRECTORY'), '*.json'), function(err, filenames) {
    filenames.forEach(function(filename) {
      let id = path.basename(filename, '.json');
      VOCABULARIES[id] = new Vocabulary(id, require(filename));
    });
  });
}

/**
  @class Vocabulary
  @constructor
  @param {String} id
  @param {Object} terms
*/
class Vocabulary {
  constructor(id, terms) {
    this.id = id;
    this.terms = terms;
  }

  /**
    Find the vocabulary with the given id.

    @method findById
    @static
    @param {String} id
    @return {Promise<Vocabulary>}
  */
  static findById(id) {
    return new Promise(function(resolve, reject) {
      let vocab = VOCABULARIES[id];
      if (vocab) {
        resolve(vocab);
      } else {
        reject(new VocabularyNotFoundError('Couldn\'t find vocabulary "' + id + '"', { id: id }));
      }
    });
  }
}

module.exports = Vocabulary;