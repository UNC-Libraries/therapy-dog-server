'use strict';

const crypto = require('crypto');
const fs = require('fs');
const uuid = require('uuid');
const Upload = require('../../models/upload');

class File {
  /**
   * @param {Upload|Buffer} contents
   * @param {Object} [options]
   * @param {String} [options.name]
   * @param {String} [options.mimetype]
  */
  constructor(contents/*, options={}*/) {
    let options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    if (contents instanceof Upload) {
      this.contents = contents;
    } else if (contents instanceof Buffer) {
      this.contents = contents;
    } else {
      throw new TypeError('A file must contain either an Upload or a Buffer');
    }

    this.id = '_' + uuid.v4();
    this._name = options.name;
    this._mimetype = options.mimetype;
  }

  /**
    * @name File#contents
    * @type {Upload|Buffer}
    */

  /**
    * @name File#id
    * @type {String}
    */

  /**
   * @type {Boolean}
   */
  get isUpload() {
    return this.contents instanceof Upload;
  }

  /**
   * @type {Boolean}
   */
  get isBuffer() {
    return this.contents instanceof Buffer;
  }

  /**
   * @type {String}
   */
  get name() {
    if (this._name) {
      return this._name;
    } else {
      if (this.isUpload) {
        return this.contents.name;
      } else {
        return 'untitled.txt';
      }
    }
  }

  /**
   * @type {String}
   */
  get mimetype() {
    if (this._mimetype) {
      return this._mimetype;
    } else {
      if (this.isUpload) {
        return this.contents.type;
      } else {
        return 'text/plain';
      }
    }
  }

  /**
   * @type {Number}
   */
  get size() {
    if (this.isUpload) {
      return this.contents.size;
    } else {
      return this.contents.length;
    }
  }

  /**
   * Calculate a hash digest of the contents of this File, using the specified `algorithm` and `encoding`.
   * <p>`algorithm` may be any of the algorithms supported by {@link https://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm crypto.createHash}, such as 'md5' or 'sha256'. `encoding` may be any encoding supported by {@link https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings Buffer}.</p>
   * @param {String} algorithm
   * @param {String} [encoding='hex']
   * @return {Promise<String>}
   */
  getHashDigest(algorithm/*, encoding='hex'*/) {
    let encoding = arguments.length <= 1 || arguments[1] === undefined ? 'hex' : arguments[1];

    if (this.isUpload) {
      let path = this.contents.path;

      return new Promise(function(resolve) {
        let hash = crypto.createHash(algorithm);
        let input = fs.createReadStream(path);

        input.on('end', function() {
          hash.end();
          resolve(hash.read().toString(encoding));
        });

        input.pipe(hash);
      });
    } else {
      let buffer = this.contents;

      return new Promise(function(resolve) {
        let hash = crypto.createHash(algorithm);
        hash.update(buffer);
        resolve(hash.digest(encoding));
      });
    }
  }
}

module.exports = File;
