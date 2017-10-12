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

const Promise = require('bluebird');
const Form = require('../models/form');
const generateBundle = require('../deposit/generate-bundle');
const generateSubmission = require('../deposit/generate-submission');
const collectNotificationRecipientEmails = require('../deposit/collect-notification-recipient-emails');
const submitZip = require('../deposit/submit-zip');
const mailer = require('../mailer');
const logging = require('../logging');
const SwordError = require('../errors').SwordError;
const config = require('../../config');

exports.create = function(req, res, next) {
  let deposit = req.body;

  // Find the form...
  let form = Form.findById(deposit.form);

  // Check to see if form destination should go somewhere other than the default location
  form.then((form) => {
    let canOverride = false;
    if (form.allowDestinationOverride !== undefined) {
      canOverride = form.allowDestinationOverride;
    }

    // If the form is coming in from the CDR admin reset the destination UUID to the one it provides.
    if (deposit.destination !== undefined && canOverride) {
      form.destination = deposit.destination;
    }

    // Override default depositor if allowed by the form.
    if (form.submitAsCurrentUser) {
      if (config.DEBUG && /AUTHENTICATION_SPOOFING/.test(req.headers.cookie)) {
        let adminUserGroups = parseAuthenticationHeaders(req.headers.cookie);
        form.depositor = adminUserGroups.depositor;
        form.isMemberOf = adminUserGroups.isMemberOf;
      } else {
        form.depositor = (req.headers['remote_user'] !== undefined) ? req.headers['remote_user'] : null;
        form.isMemberOf = (req.headers['ismemberof'] !== undefined) ? req.headers['ismemberof'] : null;
      }
    }
  });

  let depositorSignature;
  if (config.DEBUG && /AUTHENTICATION_SPOOFING/.test(req.headers.cookie)) {
    depositorSignature = parseAuthenticationHeaders(req.headers.cookie).depositor;
  } else {
    depositorSignature = req.headers['remote_user'];
  }

  // Transform input...
  let input = form.then(f => f.deserializeInput(f.sanitizeInput(deposit.values)));
  let inputSummary = form.then(f => f.summarizeInput(deposit.values));

  // Generate a bundle and submission...
  let bundle = Promise.join(form, input, depositorSignature, generateBundle);
  let submission = Promise.join(form, bundle, generateSubmission);

  // Collect notification recipients...
  let notificationRecipientEmails = Promise.join(form, input, collectNotificationRecipientEmails);
  let sendNotifications = [
      Promise.join(form, inputSummary, notificationRecipientEmails, mailer.sendDepositNotification)
  ];

  if (deposit.sendEmailReceipt) {
    sendNotifications.push(
      Promise.join(form, inputSummary, deposit.depositorEmail, mailer.sendDepositReceipt)
    );
  }

  // Submit the deposit, send email notifications, send response.
  Promise.join(form, submission, deposit.depositorEmail, submitZip)
  .then(() => { res.status(204).end(); })
  .then(() => Promise.all(sendNotifications))
  .catch(function(err) {
    if (err instanceof SwordError) {
      logging.error('Received error response from SWORD endpoint: %s', err.extra.body);
    }

    next(err);
  });
};

exports.debug = function(req, res, next) {
  let deposit = req.body;
  let depositorSignature = req.headers['remote_user'];

  // Find the form...
  let form = Form.findById(deposit.form);

  // Transform input...
  let input = form.then(f => f.deserializeInput(f.sanitizeInput(deposit.values)));

  // Generate a bundle and submission...
  let bundle = Promise.join(form, input, depositorSignature, generateBundle);
  let submission = Promise.join(form, bundle, generateSubmission);

  // Respond with the METS.
  submission
  .then((s) => { res.send(s['mets.xml']).end(); })
  .catch(function(err) {
    next(err);
  });
};

/**
 * Private function to discern user and CDR groups
 * @param values
 */
function parseAuthenticationHeaders(values) {
  let setValues = decodeURIComponent(values).split(/;\s/);
  let cdrValues = {
    depositor: null,
    isMemberOf: null
  };
  let format = function(stringValue) {
    if (stringValue !== undefined && stringValue !== null) {
      return stringValue.trim().toLowerCase();
    }
    return null;
  };

  if (setValues.length > 0) {
    setValues.forEach(function(d) {
      let keyValues = d.split('=');
      let key = format(keyValues[0]);
      let value = format(keyValues[1]);

      if (/remote_user/.test(key)) {
        cdrValues.depositor = value;
      }

      if (/ismemberof/.test(key)) {
        cdrValues.isMemberOf = value;
      }
    });
  }

  return cdrValues;
}
