import Ember from 'ember';
import FocusEntryAction from 'therapy-dog/mixins/focus-entry-action';

export default Ember.Component.extend(FocusEntryAction, {
  classNames: ['block', 'radio'],
  classNameBindings: ['required', 'invalid'],
  required: Ember.computed.alias('entry.required'),
  invalid: Ember.computed.alias('entry.invalid'),

  didReceiveAttrs() {
    this._super(...arguments);
    
    if (Ember.isBlank(this.get('entry.value'))) {
      let firstOption = this.get('entry.block.options')[0];
      let firstValue = firstOption.value ? firstOption.value : firstOption;
      
      this.set('entry.value', this.get('entry.block.defaultValue') || firstValue);
    }
  },

  focusOut: function() {
    this.set('entry.attempted', true);
  },
  
  actions: {
    clear: function() {
      this.set('entry.value', '');
    },

    focusEntry: function() {
      this.$('input').first().focus();
    }
  }
});
