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
const checker = require('../../lib/checker');
const inspect = require('util').inspect;

function assertCheckerThrows(c, value) {
  assert.throws(() => { c(value); }, checker.CheckerError);
}

function assertCheckerErrorMessage(c, value, expected) {
  try {
    c(value);
    assert.ok(false, 'expected exception');
  } catch (err) {
    if (err instanceof checker.CheckerError) {
      if (expected instanceof RegExp) {
        if (!err.message.match(expected)) {
          throw new assert.AssertionError({ message: `${inspect(err.message)} does not match ${expected}` });
        }
      } else if (typeof expected === 'string') {
        assert.equal(err.message, expected);
      }
    } else {
      throw err;
    }
  }
}

function assertCheckerErrorPath(c, value, expected) {
  try {
    c(value);
    assert.ok(false, 'expected exception');
  } catch (err) {
    if (err instanceof checker.CheckerError) {
      assert.deepEqual(err.path, expected);
    } else {
      throw err;
    }
  }
}

function assertCheckerEqual(c, value/*, expected=value*/) {
  let expected = arguments.length <= 2 || arguments[2] === undefined ? value : arguments[2];
  assert.deepStrictEqual(c(value), expected);
}

describe('Checker', function() {
  describe('type checking functions', function() {
    it('should check the any type', function() {
      let c = checker.any();

      assertCheckerEqual(c, 'test');
      assertCheckerEqual(c, '');
      assertCheckerEqual(c, undefined);
      assertCheckerEqual(c, null);
      assertCheckerEqual(c, 0);
      assertCheckerEqual(c, 123);
      assertCheckerEqual(c, true);
      assertCheckerEqual(c, false);
      assertCheckerEqual(c, { x: 1 });
    });

    it('should check a string', function() {
      let c = checker.string();

      assertCheckerEqual(c, 'test');
      assertCheckerEqual(c, '');
      assertCheckerThrows(c, undefined);
      assertCheckerThrows(c, null);
      assertCheckerThrows(c, 0);
      assertCheckerThrows(c, 123);
      assertCheckerThrows(c, true);
      assertCheckerThrows(c, false);
      assertCheckerThrows(c, { x: 1 });

      assertCheckerErrorMessage(c, undefined, 'Expected string');
      assertCheckerErrorPath(c, undefined, []);
    });

    it('should check an optional value', function() {
      let c = checker.optional(checker.string());

      assertCheckerEqual(c, 'test');
      assertCheckerEqual(c, '');
      assertCheckerEqual(c, undefined);
      assertCheckerEqual(c, null);
      assertCheckerThrows(c, 0);
      assertCheckerThrows(c, 123);
      assertCheckerThrows(c, true);
      assertCheckerThrows(c, false);
      assertCheckerThrows(c, { x: 1 });

      assertCheckerErrorMessage(c, 123, 'Expected string');
      assertCheckerErrorPath(c, 123, []);
    });

    it('should check a string with a regular expression', function() {
      let c = checker.regexp(/\d+/);

      assertCheckerThrows(c, 'test');
      assertCheckerEqual(c, '123 abc');
      assertCheckerThrows(c, undefined);

      assertCheckerErrorMessage(c, 'test', 'Expected /\\d+/');
      assertCheckerErrorPath(c, 'test', []);
    });

    it('should check a boolean', function() {
      let c = checker.boolean();

      assertCheckerThrows(c, 'test');
      assertCheckerThrows(c, '');
      assertCheckerThrows(c, undefined);
      assertCheckerThrows(c, null);
      assertCheckerThrows(c, 0);
      assertCheckerThrows(c, 123);
      assertCheckerEqual(c, true);
      assertCheckerEqual(c, false);
      assertCheckerThrows(c, { x: 1 });
    });

    it('should check a number', function() {
      let c = checker.number();

      assertCheckerThrows(c, 'test');
      assertCheckerThrows(c, '');
      assertCheckerThrows(c, undefined);
      assertCheckerThrows(c, null);
      assertCheckerEqual(c, 0);
      assertCheckerEqual(c, 123);
      assertCheckerThrows(c, true);
      assertCheckerThrows(c, false);
      assertCheckerThrows(c, { x: 1 });
    });

    it('should check the shape of an object', function() {
      let c = checker.shape({
        key: checker.string(),
        label: checker.optional(checker.string())
      });

      assertCheckerThrows(c, 'test');
      assertCheckerThrows(c, undefined);
      assertCheckerEqual(c, { key: 'x', label: '123' });
      assertCheckerEqual(c, { key: 'x' });
      assertCheckerThrows(c, { label: '123' });
      assertCheckerThrows(c, []);

      assertCheckerErrorMessage(c, 'test', 'Expected object');
      assertCheckerErrorPath(c, 'test', []);

      assertCheckerErrorMessage(c, { label: '123' }, 'Expected string at ["key"]');
      assertCheckerErrorPath(c, { label: '123' }, [ 'key' ]);
    });

    it('should not output unexpected properties when checking a shape', function() {
      let c = checker.shape({ x: checker.number() });

      assertCheckerEqual(c, { x: 123, y: 456 }, { x: 123 });
    });

    it('should check typed records', function() {
      let c = checker.recordTypes({
        lookup: checker.shape({ path: checker.arrayOf(checker.string()) }),
        string: checker.shape({ value: checker.string() })
      });

      assertCheckerThrows(c, 'test');
      assertCheckerThrows(c, undefined);
      assertCheckerEqual(c, { type: 'lookup', path: [ 'a' ] });
      assertCheckerEqual(c, { type: 'string', value: 'blah' });
      assertCheckerThrows(c, { type: 'lookup', path: 'x' });
      assertCheckerThrows(c, { type: 'string', value: 123 });
      assertCheckerThrows(c, { type: 'qwerty', blah: true });

      assertCheckerErrorMessage(c, 'test', 'Expected object');
      assertCheckerErrorPath(c, 'test', []);

      assertCheckerErrorMessage(c, { type: 'lookup', path: 'x' }, 'Expected array at ["path"]');
      assertCheckerErrorPath(c, { type: 'lookup', path: 'x' }, [ 'path' ]);

      assertCheckerErrorMessage(c, { type: 'string', value: 123 }, 'Expected string at ["value"]');
      assertCheckerErrorPath(c, { type: 'string', value: 123 }, [ 'value' ]);

      assertCheckerErrorMessage(c, { type: 'qwerty', blah: true }, /Expected "type" of/);
      assertCheckerErrorPath(c, { type: 'qwerty', blah: true }, []);
    });

    it('should check an array', function() {
      let c = checker.array();

      assertCheckerThrows(c, 'test');
      assertCheckerThrows(c, undefined);
      assertCheckerEqual(c, [ 1, false, 'xyz' ]);
    });

    it('should check an array of a given type', function() {
      let c = checker.arrayOf(checker.string());

      assertCheckerThrows(c, 'test');
      assertCheckerThrows(c, undefined);
      assertCheckerThrows(c, [ 1, false, 'xyz' ]);
      assertCheckerEqual(c, [ 'blah' ]);

      assertCheckerThrows(c, 'test', 'Expected array');
      assertCheckerErrorPath(c, 'test', []);

      assertCheckerErrorMessage(c, [ 1, false, 'xyz' ], 'Expected string at [0]');
      assertCheckerErrorPath(c, [ 1, false, 'xyz' ], [ 0 ]);
    });

    it('should check a literal value', function() {
      let c = checker.literal('test');

      assertCheckerEqual(c, 'test');
      assertCheckerThrows(c, 'etc');
      assertCheckerThrows(c, undefined);

      assertCheckerErrorMessage(c, 'etc', 'Expected "test"');
      assertCheckerErrorPath(c, 'etc', []);
    });

    it('should check that a value is one of a list of types', function() {
      let c = checker.oneOf([
        checker.string(),
        checker.number(),
        checker.arrayOf(checker.string())
      ]);

      assertCheckerEqual(c, 'test');
      assertCheckerEqual(c, [ 'blah' ]);
      assertCheckerThrows(c, [ 123 ]);
      assertCheckerThrows(c, true);
      assertCheckerThrows(c, undefined);

      assertCheckerThrows(c, true, 'Expected one of string, number, array');
      assertCheckerErrorPath(c, true, []);

      assertCheckerErrorMessage(c, [ 123 ], 'Expected one of string, number, array');
      assertCheckerErrorPath(c, [ 123 ], []);
    });

    it('should check that a value is a map of a given type', function() {
      let c = checker.mapOf(checker.oneOf([
        checker.string(),
        checker.number()
      ]));

      assertCheckerThrows(c, 'test');
      assertCheckerThrows(c, undefined);
      assertCheckerEqual(c, {});
      assertCheckerEqual(c, { x: 1, y: 'test' });
      assertCheckerThrows(c, { x: 1, y: false });

      assertCheckerErrorMessage(c, 'test', 'Expected object');
      assertCheckerErrorPath(c, 'test', []);

      assertCheckerErrorMessage(c, { x: 1, y: false }, 'Expected one of string, number at ["y"]');
      assertCheckerErrorPath(c, { x: 1, y: false }, [ 'y' ]);
    });

    it('should check mutually-recursive types using lookup', function() {
      let checkers = {};

      checkers.twice = checker.shape({
        body: checker.arrayOf(checker.lookup(checkers, 'expression'))
      });

      checkers.string = checker.shape({
        value: checker.string()
      });

      checkers.expression = checker.recordTypes({
        twice: checker.lookup(checkers, 'twice'),
        string: checker.lookup(checkers, 'string')
      });

      assertCheckerThrows(checkers.expression, 'test');
      assertCheckerThrows(checkers.expression, undefined);
      assertCheckerEqual(checkers.expression, { type: 'twice', body: [ { type: 'twice', body: [ { type: 'string', value: 'abc' } ] } ] });
      assertCheckerThrows(checkers.expression, { type: 'twice', body: [ { type: 'string', value: 'abc' }, { type: 'string', value: 123 } ] });

      assertCheckerErrorMessage(checkers.expression, { type: 'twice', body: [ { type: 'blah', value: 123 } ] }, /Expected "type" of/);
      assertCheckerErrorMessage(checkers.expression, { type: 'twice', body: [ { type: 'blah', value: 123 } ] }, /twice/);
      assertCheckerErrorMessage(checkers.expression, { type: 'twice', body: [ { type: 'blah', value: 123 } ] }, /string/);
      assertCheckerErrorMessage(checkers.expression, { type: 'twice', body: [ { type: 'blah', value: 123 } ] }, /\["body"\]\[0\]/);

      assertCheckerErrorMessage(checkers.expression, { type: 'twice', body: [ 123 ] }, 'Expected object at ["body"][0]');
      assertCheckerErrorPath(checkers.expression, { type: 'twice', body: [ 123 ] }, [ 'body', 0 ]);

      assertCheckerErrorMessage(checkers.expression, { type: 'twice', body: [ { type: 'string', value: 'abc' }, { type: 'string', value: 123 } ] }, 'Expected string at ["body"][1]["value"]');
      assertCheckerErrorPath(checkers.expression, { type: 'twice', body: [ { type: 'string', value: 'abc' }, { type: 'string', value: 123 } ] }, [ 'body', 1, 'value' ]);
    });
  });
});
