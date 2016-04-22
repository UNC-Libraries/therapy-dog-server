import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import ValueEntry from 'therapy-dog/utils/value-entry';
import Ember from 'ember';

moduleForComponent('block-checkboxes', 'Integration | Component | Checkboxes block', {
  integration: true
});

let vocabCheckboxesBlock = Ember.Object.create({
  type: 'checkboxes',
  key: 'colors',
  label: 'Primary Colors',
  options: [
    { label: 'Red', value: '#f00' },
    { label: 'Blue', value: '#0f0' },
    { label: 'Yellow', value: '#ff0' }
  ]
});

let requiredCheckboxesBlock = Ember.Object.create({
  type: 'checkboxes',
  key: 'colors',
  label: 'Primary Colors',
  options: ['Red', 'Blue', 'Yellow'],
  required: true
});

let defaultValueCheckboxesBlock = Ember.Object.create({
  type: 'checkboxes',
  key: 'colors',
  label: 'Primary Colors',
  options: ['Red', 'Blue', 'Yellow'],
  defaultValue: ['Red', 'Blue']
});

test('it renders', function(assert) {
  let entry = ValueEntry.create({ block: vocabCheckboxesBlock });
  this.set('entry', entry);
  
  this.render(hbs`{{block-checkboxes entry=entry}}`);

  assert.equal(this.$('h2').text().trim(), 'Primary Colors');
  assert.deepEqual(this.$('label').map((i, e) => $(e).text().trim()).get(), ['Red', 'Blue', 'Yellow']);
});

test('it sets the initial value to the empty array', function(assert) {
  let entry = ValueEntry.create({ block: vocabCheckboxesBlock });
  this.set('entry', entry);
  
  this.render(hbs`{{block-checkboxes entry=entry}}`);
  
  assert.deepEqual(entry.get('value'), []);
});

test('it sets the initial value to the default value if present', function(assert) {
  let entry = ValueEntry.create({ block: defaultValueCheckboxesBlock });
  this.set('entry', entry);
  
  this.render(hbs`{{block-checkboxes entry=entry}}`);
  
  assert.deepEqual(entry.get('value'), ['Red', 'Blue']);
  assert.ok(this.$('input').get(0).checked);
  assert.ok(this.$('input').get(1).checked);
});

test('it updates the entry value with the "value" property in options when clicked', function(assert) {
  let entry = ValueEntry.create({ block: vocabCheckboxesBlock });
  this.set('entry', entry);
  
  this.render(hbs`{{block-checkboxes entry=entry}}`);
  
  assert.deepEqual(entry.get('value'), []);
  
  this.$('input').eq(0).click();
  
  assert.deepEqual(entry.get('value'), ['#f00']);
  
  this.$('input').eq(1).click();
  
  assert.deepEqual(entry.get('value'), ['#f00', '#0f0']);
  
  this.$('input').eq(0).click();
  
  assert.deepEqual(entry.get('value'), ['#0f0']);
});

test('it renders with the required class if required', function(assert) {
  let entry = ValueEntry.create({ block: requiredCheckboxesBlock });
  this.set('entry', entry);
  
  this.render(hbs`{{block-checkboxes entry=entry}}`);
  
  assert.ok(this.$('.block').hasClass('required'));
});

test('it is invalid with nothing checked if required', function(assert) {
  let entry = ValueEntry.create({ block: requiredCheckboxesBlock });
  this.set('entry', entry);

  this.render(hbs`{{block-checkboxes entry=entry}}`);

  assert.ok(this.$('.block').hasClass('invalid'));
  
  this.$('input').eq(0).click();

  assert.notOk(this.$('.block').hasClass('invalid'));
});