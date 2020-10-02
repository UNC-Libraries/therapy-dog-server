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

const isEmpty = require('./utils').isEmpty;

function evaluateString(expression) {
  return { type: 'string', value: expression.value };
}

function evaluateLookup(expression, context) {
  let value = context;
  for (let i = 0; i < expression.path.length; i++) {
    if (expression.path[i] in value) {
      value = value[expression.path[i]];
    } else {
      value = undefined;
      break;
    }
  }
  return { type: 'data', value: value };
}

function evaluateStructure(expression, context) {
  let properties;
  if (expression.properties) {
    properties = Object.keys(expression.properties).reduce(function(result, key) {
      result[key] = evaluateExpression(expression.properties[key], context);
      return result;
    }, {});
  } else {
    properties = {};
  }

  let children;
  if (expression.children) {
    children = evaluateBody(expression.children, context);
  } else {
    children = [];
  }

  let structure = {
    type: 'structure',
    name: expression.name,
    properties,
    children
  };

  if ('keep' in expression) {
    structure.keep = expression.keep;
  }

  return structure;
}

function evaluateEach(expression, context) {
  let items = evaluateExpression(expression.items, context);

  // unwrap
  items = items.value;

  if (isEmpty(items)) {
    return { type: 'data', value: undefined };
  }

  if (!Array.isArray(items)) {
    items = [ items ];
  }

  // items remain unwrapped when passing as a context, since lookups will wrap them.
  return items.reduce(function(body, item, index) {
    let locals = {};

    /* istanbul ignore else */
    if (expression.locals) {
      if (expression.locals.item) {
        locals[expression.locals.item] = item;
      }

      if (expression.locals.index) {
        locals[expression.locals.index] = index;
      }
    }

    return body.concat(evaluateBody(expression.body, Object.assign({}, context, locals)));
  }, []);
}

function testPresent(predicate, context) {
  return !isEmpty(evaluateExpression(predicate.value, context).value);
}

function testPredicates(predicates, context) {
  return predicates.some(function(predicate) {
    /* istanbul ignore else */
    if (predicate.type === 'present') {
      return testPresent(predicate, context);
    } else {
      throw new Error('Unknown predicate type: ' + predicate.type);
    }
  });
}

function evaluateChoose(expression, context) {
  for (let i = 0; i < expression.choices.length; i++) {
    if (testPredicates(expression.choices[i].predicates, context)) {
      return evaluateBody(expression.choices[i].body, context);
    }
  }

  if (expression.otherwise) {
    return evaluateBody(expression.otherwise, context);
  } else {
    return [];
  }
}

function evaluateArrow(expression, context) {
  let items = evaluateExpression(expression.items, context);

  // unwrap
  items = items.value;

  if (isEmpty(items)) {
    return { type: 'data', value: undefined };
  }

  if (!Array.isArray(items)) {
    items = [ items ];
  }

  // wrap each item -- they are always data since they come from a lookup expression.
  items = items.map(function(item) {
    return { type: 'data', value: item };
  });

  return items.reduce(function(body, item) {
    let result = item;
    for (let i = expression.target.length - 1; i >= 0; i--) {
      let structure = evaluateStructure(expression.target[i], item);
      structure.children = [ result ];

      result = structure;
    }
    return body.concat(result);
  }, []);
}

function evaluateBody(expressions, context) {
  return expressions.reduce(function(body, expression) {
    return body.concat(evaluateExpression(expression, context));
  }, []);
}

/**
 * @function
 * @name evaluate
 * @param {Object} expression
 * @param {Object} context - The context to use for lookups.
 * @return {*}
 */
function evaluateExpression(expression, context) {
  /* istanbul ignore else */
  if (expression.type === 'string') {
    return evaluateString(expression, context);
  } else if (expression.type === 'lookup') {
    return evaluateLookup(expression, context);
  } else if (expression.type === 'structure') {
    return evaluateStructure(expression, context);
  } else if (expression.type === 'each') {
    return evaluateEach(expression, context);
  } else if (expression.type === 'choose') {
    return evaluateChoose(expression, context);
  } else if (expression.type === 'arrow') {
    return evaluateArrow(expression, context);
  } else {
    throw new Error('Unknown expression type: ' + expression.type);
  }
}

module.exports = evaluateExpression;
