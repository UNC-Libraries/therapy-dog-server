'use strict';

const fs = require('fs');
const tmp = require('tmp');
const uuid = require('uuid');
const Upload = require('../lib/models/upload');

exports.buildTestUpload = function(name, type, buffer) {
  let tmpobj = tmp.fileSync();
  fs.writeSync(tmpobj.fd, buffer, 0, buffer.length);

  return new Upload(uuid.v4(), {
    name: name,
    type: type,
    path: tmpobj.name,
    size: buffer.length
  });
};

exports.createTestUpload = function(name, type, buffer) {
  let tmpobj = tmp.fileSync();
  fs.writeSync(tmpobj.fd, buffer, 0, buffer.length);

  return Upload.createFromFile({
    filename: uuid.v4(),
    originalname: name,
    mimetype: type,
    path: tmpobj.name,
    size: buffer.length
  });
};