'use strict';

/**
 * send email with request
 * @param {string} title - hook type
 * @param {string} content - request body
 */
function sendTechnicalMail(title, content) {
    var currentSite = require('dw/system/Site').getCurrent();
    var technicalEmailAddress = currentSite.getCustomPreferenceValue('drTechnicalEmailAddress');
    if (!empty(technicalEmailAddress)) {
        var Mail = require('dw/net/Mail');
        var mail = new Mail();
        mail.addTo(technicalEmailAddress);
        mail.setFrom('noreply@us01.dx.commercecloud.salesforce.com');
        mail.setSubject('Digital River Webhook Test');
        mail.setContent(title + '\n\n' + content);
        mail.send();
    }
}

/**
 * generate signature and compare it with the one from DR
 * @param {string} signature - signature to compare
 * @param {string} requestBodyAsString - requestBody to generate signature
 * @return {Object} response of signature check
 */
function checkSignature(signature, requestBodyAsString) {
    var forResponse = {
        error: true,
        errorMessasge: ''
    };

    try {
        var Mac = require('dw/crypto/Mac');
        var Encoding = require('dw/crypto/Encoding');
        var CurrentSite = require('dw/system/Site').getCurrent();
        var mac = new Mac(Mac.HMAC_SHA_256);
        var webhookSignatureToken = CurrentSite.getCustomPreferenceValue('drWebhookSignatureToken') || '';

        var signatureSplit = signature.split(', '); // [{timestamp}, {signature}]
        var stringToBeHashed = signatureSplit[0] + '.' + requestBodyAsString; // {timestamp}.{requestBodyAsString}
        var signatureInBytes = mac.digest(stringToBeHashed, webhookSignatureToken);
        var generatedSignature = Encoding.toBase64(signatureInBytes);
        if (generatedSignature !== signatureSplit[1]) {
            var requestBody = JSON.parse(requestBodyAsString);
            var checkoutId = requestBody.id ? requestBody.id : 'error';
            forResponse.errorMessage = '\nincorrect signature: ' + signature + '\nfor body with id: ' + checkoutId;
        } else {
            forResponse.error = false;
        }
    } catch (e) {
        forResponse.errorMessage = e;
    }


    return forResponse;
}

module.exports = {
    sendTechnicalMail: sendTechnicalMail,
    checkSignature: checkSignature
};
