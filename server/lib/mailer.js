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

const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const Handlebars = require('handlebars');
const nodemailer = require('nodemailer');
const stubTransport = require('nodemailer-stub-transport');
const config = require('../config');

let transportOptions;
if (config.MAILER_CONNECTION_URL === 'stub') {
  let stub = stubTransport();
  transportOptions = stub;
  exports.stubTransport = stub;
} else {
  transportOptions = config.MAILER_CONNECTION_URL;
}

const transport = nodemailer.createTransport(transportOptions);

Handlebars.registerPartial('items-list-html', fs.readFileSync(path.join(__dirname, `../templates/-items-list-html.hbs`)).toString());
Handlebars.registerPartial('items-list-text', fs.readFileSync(path.join(__dirname, `../templates/-items-list-text.hbs`)).toString());
Handlebars.registerPartial('css', fs.readFileSync(path.join(__dirname, `../templates/-css.hbs`)).toString());

function getTemplate(name, part) {
  return Handlebars.compile(fs.readFileSync(path.join(__dirname, `../templates/${name}.${part}.hbs`)).toString());
}

function depositReceiptSender(context, callback, siteUrl) {
  let subjectTemplate = getTemplate('deposit-receipt', 'subject');
  let textTemplate = getTemplate('deposit-receipt', 'text');
  let htmlTemplate = getTemplate('deposit-receipt', 'html');

  let message = {
    subject: subjectTemplate(context),
    text: textTemplate(context, siteUrl),
    html: htmlTemplate(context, siteUrl),
    to: context.to,
    from: config.FROM_EMAIL
  };

  return transport.sendMail(message);
}

function depositNotificationSender(context) {
  let subjectTemplate = getTemplate('deposit-notification', 'subject');
  let textTemplate = getTemplate('deposit-notification', 'text');
  let htmlTemplate = getTemplate('deposit-notification', 'html');

  let message = {
    subject: subjectTemplate(context),
    text: textTemplate(context, context.siteUrl),
    html: htmlTemplate(context, context.siteUrl),
    to: context.to,
    from: config.FROM_EMAIL
  };

  return transport.sendMail(message);
}

/**
 * Send a deposit receipt email.
 * @function sendDepositReceipt
 * @param {Form} form
 * @param {Object} summary
 * @param {string} address
 * @return {Promise}
 **/
exports.sendDepositReceipt = function(form, summary, address) {
  return Promise.try(function() {
    return depositReceiptSender({ form: form, items: summary, siteUrl: config.SITE_URL, to: address });
  });
};

/**
 * Send a deposit notification email.
 * @function sendDepositNotification
 * @param {Form} form
 * @param {Object} summary
 * @param {Array<string>} addresses
 * @return {Promise}
 **/
exports.sendDepositNotification = function(form, summary, addresses) {
  return Promise.try(function() {
    if (addresses.length > 0) {
      return depositNotificationSender({ form: form, items: summary, siteUrl: config.SITE_URL, to: addresses });
    }
  });
};
