'use strict';

const Promise = require('bluebird');
const Upload = require('../upload');
const getOptionLabel = require('./options').getOptionLabel;

exports.section = function(block, value, reduceChildren) {
  if (block.repeat) {
    return Promise.all(value.map(item => reduceChildren(block.children, item, []))).then((summary) => {
      return {
        section: true,
        repeat: true,
        displayInline: (block.inline !== null && block.inline !== undefined) ? block.inline : false,
        label: block.label,
        value: summary
      };
    });
  } else {
    return reduceChildren(block.children, value, []).then((summary) => {
      return {
        section: true,
        displayInline: (block.inline !== null && block.inline !== undefined) ? block.inline : false,
        label: block.label,
        value: summary
      };
    });
  }
};

exports.text = function(block, value) {
  return { label: block.label, value: String(value) };
};

exports.email = function(block, value) {
  return { label: block.label, value: String(value), hide: (block.hide) ? block.hide : false };
};

exports.orcid = function(block, value) {
  return { label: block.label, value: String(value) };
};

exports.date = function(block, value) {
  return { label: block.label, value: String(value) };
};

exports.select = function(block, value) {
  return getOptionLabel(block.options, value)
    .then(function(label) {
      if (label !== undefined) {
        return { label: block.label, value: label };
      } else {
        return { label: block.label, value: '(none)' };
      }
    });
};

exports.checkboxes = function(block, value) {
  if (Array.isArray(value)) {
    return Promise.all(value.map(function(v) {
      return getOptionLabel(block.options, v);
    })).then(function(labels) {
      return labels.filter(l => l !== undefined);
    }).then(function(labels) {
      if (labels.length === 0) {
        return { label: block.label, value: '(none)' };
      } else {
        return { label: block.label, value: labels.join(', ') };
      }
    });
  } else {
    return { label: block.label, value: '(none)' };
  }
};

exports.tokens = function(block, value) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { label: block.label, value: '(none)' };
    } else {
      return { label: block.label, value: value.join(', ') };
    }
  } else {
    return { label: block.label, value: '(none)' };
  }
};

exports.radio = function(block, value) {
  return getOptionLabel(block.options, value)
    .then(function(summary) {
      return { label: block.label, value: summary };
    });
};

exports.file = function(block, value) {
  if (block.multiple) {
    return Promise.all(value.map(function(v) {
      return Upload.findById(v);
    })).then(function(uploads) {
      if (uploads.length === 0) {
        return { label: block.label, value: '(none)' };
      } else {
        return { label: block.label, value: uploads.map(u => u.name).join(', ') };
      }
    });
  } else {
    if (typeof value === 'string') {
      return Upload.findById(value).then(function(upload) {
        return { label: block.label, value: upload.name };
      });
    } else {
      return { label: block.label, value: '(none)' };
    }
  }
};

exports.agreement = function(block, value) {
  if (value) {
    return { label: block.name, value: 'Accepted' };
  }
};
