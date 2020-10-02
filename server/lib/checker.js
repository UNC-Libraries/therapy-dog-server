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

const inherits = require('util').inherits;

/**
 * @namespace checker
 */

/**
 * @typedef {function} checkerFunction
 * @param value - The value to check.
 * @returns The checked value.
 * @throws CheckerError
 */

/**
 * @class CheckerError
 * @param {string} message
 * @param {Array<string>} path - the path to the value that caused the original CheckerError
 */
const CheckerError = function(message/*, path=[]*/) {
  let path = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;

  this.originalMessage = message;

  if (path.length > 0) {
    this.message = `${message} at ${path.map(i => `[${JSON.stringify(i)}]`).join('')}`;
  } else {
    this.message = message;
  }

  this.path = path;
};
inherits(CheckerError, Error);
exports.CheckerError = CheckerError;

function buildTypeofChecker(type) {
  return function() {
    let checker = function(value) {
      if (typeof value !== type) {
        throw new CheckerError(`Expected ${checker}`);
      }

      return value;
    };

    checker.toString = function() {
      return type;
    };

    return checker;
  };
}

/**
 * Build a {@link checkerFunction checker function} that returns its argument if it is a string, and throws a {@link CheckerError} otherwise.
 * @function string
 * @memberof checker
 * @return {checkerFunction}
 **/
exports.string = buildTypeofChecker('string');

/**
 * Build a {@link checkerFunction checker function} that returns its argument if it is a number, and throws a {@link CheckerError} otherwise.
 * @function number
 * @memberof checker
 * @return {checkerFunction}
 **/
exports.number = buildTypeofChecker('number');

/**
 * Build a {@link checkerFunction checker function} that returns its argument if it is a boolean, and throws a {@link CheckerError} otherwise.
 * @function boolean
 * @memberof checker
 * @return {checkerFunction}
 **/
exports.boolean = buildTypeofChecker('boolean');

/**
 * Build a {@link checkerFunction checker function} that returns its argument if it is an object, and throws a {@link CheckerError} otherwise.
 * @function object
 * @memberof checker
 * @return {checkerFunction}
 **/
exports.object = buildTypeofChecker('object');

/**
 * Build a {@link checkerFunction checker function} that returns its argument if it is an array, and throws a {@link CheckerError} otherwise.
 * @function array
 * @memberof checker
 * @return {checkerFunction}
 **/
exports.array = function() {
  let checker = function(value) {
    if (!Array.isArray(value)) {
      throw new CheckerError(`Expected ${checker}`);
    }

    return value;
  };

  checker.toString = function() {
    return 'array';
  };

  return checker;
};

/**
 * Build a {@link checkerFunction checker function} that just returns its argument.
 * @function any
 * @memberof checker
 * @return {checkerFunction}
 **/
exports.any = function() {
  let checker = function(value) {
    return value;
  };

  checker.toString = function() {
    return 'any';
  };

  return checker;
};

/**
 * Build a {@link checkerFunction checker function} that returns its argument if it is equal to `literal`, and throws a {@link CheckerError} otherwise.
 * @function literal
 * @memberof checker
 * @param literal
 * @return {checkerFunction}
 **/
exports.literal = function(literal) {
  let checker = function(value) {
    if (value !== literal) {
      throw new CheckerError(`Expected ${checker}`);
    }

    return value;
  };

  checker.toString = function() {
    return JSON.stringify(literal);
  };

  return checker;
};

/**
 * Build a {@link checkerFunction checker function} that returns its argument if it is a string that matches the `regexp`, and throws a {@link CheckerError} otherwise.
 * @function regexp
 * @memberof checker
 * @param regexp
 * @return {checkerFunction}
 **/
exports.regexp = function(regexp) {
  let checker = function(value) {
    if (typeof value !== 'string' || !value.match(regexp)) {
      throw new CheckerError(`Expected ${checker}`);
    }

    return value;
  };

  checker.toString = function() {
    return regexp.toString();
  };

  return checker;
};

/**
 * Build a {@link checkerFunction checker function} that returns an object with the checked properties of its argument if each {@link checkerFunction checker function} in `spec` does not throw a {@link CheckerError} for the corresponding property, and throws a {@link CheckerError} otherwise. Properties not in `spec` are ignored and absent in the output.
 * @example
 * let contactChecker = checker.shape({ name: checker.string(), email: checker.string() });
 *
 * // returns { name: 'Someone', email: 'someone@example.com' }
 * contactChecker({ name: 'Someone', email: 'someone@example.com' });
 *
 * // returns { name: 'Someone', email: 'someone@example.com' }
 * contactChecker({ name: 'Someone', email: 'someone@example.com', sign: 'Gemini' });
 *
 * // throws CheckerError
 * contactChecker({ name: { first: 'Someone' }, email: 'someone@example.com' });
 *
 * // throws CheckerError
 * contactChecker('someone@example.com');
 * @function shape
 * @memberof checker
 * @param {Object.<string, checkerFunction>} spec
 * @return {checkerFunction}
 **/
exports.shape = function(spec) {
  let keys = Object.keys(spec);

  let checker = function(value) {
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new CheckerError('Expected object');
    }

    let result = {};
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];

      try {
        let prop = spec[key](value[key]);

        if (prop !== undefined) {
          result[key] = prop;
        }
      } catch (err) {
        if (err instanceof CheckerError) {
          throw new CheckerError(err.originalMessage, [ key ].concat(err.path));
        } else {
          throw err;
        }
      }
    }

    return result;
  };

  checker.toString = function() {
    return 'object';
  };

  return checker;
};

/**
 * Build a {@link checkerFunction checker function} that returns an array containing the checked elements of its argument if the {@link checkerFunction checker function} does not throw a {@link CheckerError} for any of the items, and throws a {@link CheckerError} otherwise.
 * @example
 * let numbersChecker = checker.arrayOf(checker.number());
 *
 * // returns [1, 2, 3]
 * numbersChecker([1, 2, 3]);
 *
 * // throws CheckerError
 * numbersChecker(['a', 'b', 'c']);
 * @function arrayOf
 * @memberof checker
 * @param type
 * @return {checkerFunction}
 **/
exports.arrayOf = function(type) {
  let checker = function(value) {
    if (!Array.isArray(value)) {
      throw new CheckerError('Expected array');
    }

    let result = [];
    for (let i = 0; i < value.length; i++) {
      try {
        result[i] = type(value[i]);
      } catch (err) {
        if (err instanceof CheckerError) {
          throw new CheckerError(err.originalMessage, [ i ].concat(err.path));
        } else {
          throw err;
        }
      }
    }
    return result;
  };

  checker.toString = function() {
    return 'array';
  };

  return checker;
};

/**
 * Build a {@link checkerFunction checker function} that returns an object containing the checked properties of its argument if the {@link checkerFunction checker function} `type` does not throw a {@link CheckerError} for any of the values, and throws a {@link CheckerError} otherwise.
 * @example
 * let numbersChecker = checker.mapOf(checker.number());
 *
 * // returns { a: 1, b: 2 }
 * numbersChecker({ a: 1, b: 2 });
 *
 * // throws CheckerError
 * numbersChecker({ a: true, b: false });
 * @function mapOf
 * @memberof checker
 * @param type
 * @return {checkerFunction}
 **/
exports.mapOf = function(type) {
  let checker = function(value) {
    if (typeof value !== 'object') {
      throw new CheckerError('Expected object');
    }

    let keys = Object.keys(value);
    let result = {};
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      try {
        result[key] = type(value[key]);
      } catch (err) {
        if (err instanceof CheckerError) {
          throw new CheckerError(err.originalMessage, [ key ].concat(err.path));
        } else {
          throw err;
        }
      }
    }
    return result;
  };

  checker.toString = function() {
    return 'object';
  };

  return checker;
};

/**
 * Build a {@link checkerFunction checker function} that returns the corresponding checked value of its argument for the first {@link checkerFunction checker functions} in `types` that does not throw a {@link CheckerError}, and throws a {@link CheckerError} if all of the {@link checkerFunction checker functions} throw a {@link CheckerError}.
 * @example
 * let numbersStringsChecker = checker.oneOf([checker.number(), checker.string()]);
 *
 * // returns 'a'
 * numbersStringsChecker('a');
 *
 * // returns 1
 * numbersStringsChecker(1);
 *
 * // throws CheckerError
 * numbersStringsChecker(true);
 * @function oneOf
 * @memberof checker
 * @param types
 * @return {checkerFunction}
 **/
exports.oneOf = function(types) {
  let checker = function(value) {
    for (let i = 0; i < types.length; i++) {
      try {
        return types[i](value);
      } catch (err) {
        if (err instanceof CheckerError) {
          continue;
        } else {
          throw err;
        }
      }
    }
    throw new CheckerError(`Expected ${checker}`);
  };

  checker.toString = function() {
    return `one of ${types.map(t => t.toString()).join(', ')}`;
  };

  return checker;
};

/**
 * Build a {@link checkerFunction checker function} that checks that the `type` property of its argument is one of the keys in `types`, and if so, returns an object with a `type` property set to that key, and with the properties from the checked value of the checker function's argument using the {@link checkerFunction checker function} in `types` for that key if it does not throw a {@link CheckerError}, and throws a {@link CheckerError} otherwise.
 * @example
 * let expressionsChecker = checker.recordTypes({
 *   string: checker.shape({ value: checker.string() }),
 *   lookup: checker.shape({ path: checker.arrayOf(checker.string()) })
 * });
 *
 * // returns { type: 'string', value: 'abc' }
 * expressionsChecker({ type: 'string', value: 'abc' });
 *
 * // returns { type: 'lookup', path: ['x', 'y'] }
 * expressionsChecker({ type: 'lookup', path: ['x', 'y'] });
 *
 * // throws CheckerError
 * expressionsChecker({ type: 'string', value: 123 });
 * expressionsChecker({ type: 'lookup', path: 'x' });
 * expressionsChecker({ type: 'blah', stuff: true });
 * @function recordTypes
 * @memberof checker
 * @param types
 * @return {checkerFunction}
 **/
exports.recordTypes = function(types) {
  let keys = Object.keys(types);

  let checker = function(value) {
    if (typeof value !== 'object') {
      throw new CheckerError('Expected object');
    }

    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];

      if (value.type === key) {
        return Object.assign({ type: key }, types[key](value));
      }
    }

    throw new CheckerError(`Expected "type" of ${keys.map(k => `"${k}"`).join(', ')}`);
  };

  checker.toString = function() {
    return 'object';
  };

  return checker;
};

/**
 * Build a {@link checkerFunction checker function} that returns its argument if it is undefined or null, and returns the result of passing its argument to the {@link checkerFunction checker function} `type` otherwise.
 * @example
 * let optionalStringChecker = checker.optional(checker.string()));
 *
 * // returns 'abc'
 * optionalStringChecker('abc');
 *
 * // returns undefined
 * optionalStringChecker(undefined);
 *
 * // throws CheckerError
 * optionalStringChecker(123);
 * @function optional
 * @memberof checker
 * @param type
 * @return {checkerFunction}
 **/
exports.optional = function(type) {
  let checker = function(value) {
    if (value === undefined || value === null) {
      return value;
    }

    return type(value);
  };

  checker.toString = function() {
    return `optional ${type}`;
  };

  return checker;
};

/**
 * Build a {@link checkerFunction checker function} that looks up the checker corresponding to `key` in `checkers` and returns its checked value. This can be used to support mutually-recursive types.
 * @example
 * let checkers = {};
 *
 * checkers.twice = checker.shape({
 *   body: checker.arrayOf(checker.lookup(checkers, 'expression'))
 * });
 *
 * checkers.string = checker.shape({
 *   value: checker.string()
 * });
 *
 * checkers.expression = checker.recordTypes({
 *   twice: checker.lookup(checkers, 'twice'),
 *   string: checker.lookup(checkers, 'string')
 * });
 *
 * // returns { type: 'twice', body: [{ type: 'string', value: 'abc' }] }
 * checkers.expression({ type: 'twice', body: [{ type: 'string', value: 'abc' }] });
 * @function lookup
 * @memberof checker
 * @param checkers
 * @param key
 * @return {function}
 **/
exports.lookup = function(checkers, key) {
  let checker = function(value) {
    return checkers[key](value);
  };

  checker.toString = function() {
    return key;
  };

  return checker;
};
