'use strict';

var drHooksHelper = require('*/cartridge/scripts/digitalRiver/hooksObserver/drHooksHelper');

/**
 *
 * @param {Object} data - hook data
 * @return {Object} - data for response
 */
function refundPendingHandler(data) { // eslint-disable-line no-unused-vars
    // email section
    drHooksHelper.sendTechnicalMail('Type: refundPending. Request data:', JSON.stringify(data));

    return {
        statusCode: 200
    };
}

/**
 *
 * @param {Object} data - hook data
 * @return {Object} - data for response
 */
function refundCompleteHandler(data) { // eslint-disable-line no-unused-vars
    // email section
    drHooksHelper.sendTechnicalMail('Type: refundComplete. Request data:', JSON.stringify(data));

    return {
        statusCode: 200
    };
}

/**
 *
 * @param {string} type - hook type, may be 'error' when no type received
 * @param {Object} data - hook data
 * @return {Object} - data for response
 */
function defaultHandler(type, data) { // eslint-disable-line no-unused-vars
    var statusCode = 200;
    if (type === 'error') {
        statusCode = 500;
    }
    return {
        statusCode: statusCode
    };
}

module.exports = {
    'refund.pending': refundPendingHandler,
    'refund.complete': refundCompleteHandler,
    'default': defaultHandler // eslint-disable-line quote-props
};
