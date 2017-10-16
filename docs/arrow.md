# Metadata mapping with Arrow

*Note: so that the examples here can be easily copied and pasted into form definitions, templates are written as they would be in JSON.*

```javascript
const Arrow = require('./lib/arrow');
const XML = require('./lib/arrow/models/xml');
const Xmlbuilder = require('xmlbuilder');

function show(thing) {
  console.log(require('util').inspect(thing, { depth: null }));
}
```

## Arrow evaluates *expressions* using a *context* as input. Expressions evaluate to *structures* and *literals*.

```javascript
let namePartTemplate = new Arrow({
  "type": "structure",
  "name": "namePart",
  "properties": {
    "type": { "type": "string", "value": "given" }
  },
  "children": [
    { "type": "lookup", "path": ["author", "first"] }
  ]
});

let namePartContext = { author: { first: 'Someone' } };

show(namePartTemplate.evaluate(namePartContext));
// { type: 'namePart',
//   properties: { type: 'given' },
//   children: [ 'Someone' ] }
```

## Arrow provides an *each* expression for iteration.

```javascript
let multipleAuthorsTemplate = new Arrow({
  "type": "each",
  "items": { "type": "lookup", "path": ["authors"] },
  "locals": {
    "item": "author"
  },
  "body": [
    { "type": "lookup", "path": ["author", "name"] }
  ]
});

let multipleAuthorsContext = { authors: [{ name: 'Someone' }, { name: 'Someone Else' }] };

show(multipleAuthorsTemplate.evaluate(multipleAuthorsContext));
// [ 'Someone', 'Someone Else' ]
```

## Arrow provides an *arrow* expression for writing mapping expressions in a declarative style.

```javascript
let roleTemplate = new Arrow({
  "type": "arrow",
  "items": { "type": "lookup", "path": ["roles"] },
  "target": [
    { "type": "structure", "name": "role" },
    { "type": "structure", "name": "roleTerm" }
  ]
});

let roleContext = { roles: ['Author', 'Editor'] };

show(roleTemplate.evaluate(roleContext));
//[ { type: 'role',
//    properties: {},
//    children: [ { type: 'roleTerm', properties: {}, children: [ 'Author' ] } ] },
//  { type: 'role',
//    properties: {},
//    children: [ { type: 'roleTerm', properties: {}, children: [ 'Editor' ] } ] } ]
```

## Arrow provides a *choose* expression for conditional evaluation.

```javascript
let optionalMiddleNameTemplate = new Arrow({
  "type": "each",
  "items": { "type": "lookup", "path": ["authors"] },
  "locals": {
    "item": "author"
  },
  "body": [
    {
      "type": "structure",
      "name": "namePart",
      "children": [
        {
          "type": "choose",
          "choices": [
            {
              "predicates": [
                { "type": "present", "value": { "type": "lookup", "path": ["author", "middle"] } }
              ],
              "body": [
                { "type": "lookup", "path": ["author", "first"] },
                { "type": "string", "value": " " },
                { "type": "lookup", "path": ["author", "middle"] }
              ]
            }
          ],
          "otherwise": [
            { "type": "lookup", "path": ["author", "first"] }
          ]
        }
      ]
    }
  ]
});

let optionalMiddleNameContext = { authors: [{ first: 'Someone', middle: 'E' }, { first: 'Someone' }] };

show(optionalMiddleNameTemplate.evaluate(optionalMiddleNameContext));
// [ { type: 'namePart',
//     properties: {},
//     children: [ 'Someone', ' ', 'E' ] },
//   { type: 'namePart', properties: {}, children: [ 'Someone' ] } ]
```

## Arrow *compacts* output, removing structures with only *absent* data for lookups, but keeping structures without lookups.

```javascript
let compactNameTemplate = new Arrow({
  "type": "structure",
  "name": "name",
  "children": [
    {
      "type": "structure",
      "name": "namePart",
      "properties": {
        "type": { "type": "string", "value": "given" }
      },
      "children": [
        { "type": "lookup", "path": ["author", "first"] }
      ]
    },
    {
      "type": "structure",
      "name": "namePart",
      "properties": {
        "type": { "type": "string", "value": "family" }
      },
      "children": [
        { "type": "lookup", "path": ["author", "last"] }
      ]
    },
    {
      "type": "structure",
      "name": "role",
      "children": [
        {
          "type": "structure",
          "name": "roleTerm",
          "children": [
            { "type": "string", "value": "Author" }
          ]
        }
      ]
    }
  ]
});

let compactNameContext = { author: { first: 'Someone' } };

show(compactNameTemplate.evaluate(compactNameContext));
// { type: 'name',
//   properties: {},
//   children: 
//    [ { type: 'namePart',
//        properties: { type: 'given' },
//        children: [ 'Someone' ] },
//      { type: 'role',
//        properties: {},
//        children: [ { type: 'roleTerm', properties: {}, children: [ 'Author' ] } ] } ] }
```

## Arrow defines an XML *model* for mapping XML metadata, which *renders* XML using Xmlbuilder.

```javascript
let xml = new XML(namePartTemplate.evaluate(namePartContext));

xml.render().toString();
// '<namePart type="given">Someone</namePart>'

let builder = Xmlbuilder.create('name', { encoding: 'utf-8' });
xml.render(builder);
builder.toString();
// '<name><namePart type="given">Someone</namePart></name>'
```
