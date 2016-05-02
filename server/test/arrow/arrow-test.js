'use strict';

const Arrow = require('../../lib/arrow');
const assert = require('assert');

describe('Arrow', function() {
  describe('constructor', function() {
    it('throws a TypeError when passed an invalid expression', function() {
      // Lookup path isn't an array.
      let invalid = {
        type: 'lookup',
        path: 'blah'
      };

      assert.throws(function() {
        /*jshint nonew: false */
        new Arrow(null, invalid);
      }, TypeError);
    });
  });
});
