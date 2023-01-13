'use strict';

var digitalRiver = require('*/cartridge/scripts/services/digitalRiver');
var logHelper = require('*/cartridge/scripts/services/logHelper');
var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.customer');

/**
 * Digital River API - Create Customer
 *
 * @param  {string} email Email from checkout
 * @param  {string} uuid Unique value from SFCC.
 *
 * @return  {dw.svc.Result} call result
 */
var createCustomer = function (email, uuid) { // eslint-disable-line no-unused-vars
    var customerObject = {
        id: uuid,
        email: email,
        metadata: {
            CustomerSegment: 'Consumer'
        }
    };

    var drCustomerService = digitalRiver.createDigitalRiverService('/customers');
    logger.info('Sending "create customer" request to {0}', drCustomerService.getURL());

    var result = drCustomerService.call(customerObject);

    if (result.ok) {
        logger.info('Customer successfully created for {0}', logHelper.getMaskedEmail(email));
    } else {
        logger.error('Error while creating customer: {0}', JSON.stringify(result.errorMessage));
    }
    return result;
};


/**
  * Sends "update customer" request to Digital River
  * @param {string} customerId id of customer to be updated
  * @param {Object} payload data to be updated
  * @returns {dw.svc.Result} service result
  */
function updateCustomer(customerId, payload) {
    var drCustomerService = digitalRiver.createDigitalRiverService('/customers/' + customerId);
    logger.info('Sending "update customer" request to {0}', drCustomerService.getURL());
    var result = drCustomerService.call(payload);
    if (result.ok) {
        logger.info('Customer successfully updated');
    } else {
        logger.error('Error while updating customer: {0}', result.errorMessage);
    }
    return result;
}

/**
 * saves payment instrument to customers wallet
 * @param {string} customerId - The current customer
 * @param {string} sourceId payment source id
 * @returns {dw.svc.Result} service call result
 */
function savePaymentToCustomer(customerId, sourceId) {
    var drCheckoutSvc = digitalRiver.createDigitalRiverService('/customers/' + customerId + '/sources/' + sourceId);
    logger.info('Attaching payment source to customer {0}', drCheckoutSvc.getURL());
    var callResult = drCheckoutSvc.call();
    if (callResult.ok) {
        logger.info('Payment source attached to customer {0}', customerId);
    } else {
        logger.error('Error while attaching payment source to customer: {0}', JSON.stringify(callResult.errorMessage));
    }
    return callResult;
}

/**
 * saves payment instrument to customers wallet
 * @param {string} customerId - The current customer
 * @param {string} sourceId payment source id
 * @returns {dw.svc.Result} service call result
 */
function deletePaymentForCustomer(customerId, sourceId) {
    var drCheckoutSvc = digitalRiver.createDigitalRiverService('/customers/' + customerId + '/sources/' + sourceId);
    drCheckoutSvc.setRequestMethod('DELETE');
    logger.info('Deleting payment source for customer {0}', drCheckoutSvc.getURL());
    var callResult = drCheckoutSvc.call();
    if (callResult.ok) {
        logger.info('Payment source deleted for customer {0}', customerId);
    } else {
        logger.error('Error while deleting payment source for customer: {0}', JSON.stringify(callResult.errorMessage));
    }
    return callResult;
}

/**
 * Sets payment sourceId as default payment for the customer
 * @param {string} customerId - The current customer
 * @param {string} sourceId payment source id
 * @returns {dw.svc.Result} service call result
 */
function setCustomerDefaultPayment(customerId, sourceId) {
    var drCheckoutSvc = digitalRiver.createDigitalRiverService('/customers/' + customerId);
    var body = {
        defaultSourceId: sourceId
    };
    logger.info('Sending API request to set default source {0} for customer {1} by url {2}', sourceId, customerId, drCheckoutSvc.getURL());
    var callResult = drCheckoutSvc.call(body);
    if (callResult.ok) {
        logger.info('Payment source {0} set as default for customer {1}', sourceId, customerId);
    } else {
        logger.error('Error while setting customer default payment source: {0}', JSON.stringify(callResult.errorMessage));
    }
    return callResult;
}

/**
 * Get Digital River customer data
 * @param {string} customerId - Digital River customer ID
 * @returns {Object} - Digital River customer data
 */
function getCustomerById(customerId) {
    var drCustomer = null;
    var drCustomerSvc = digitalRiver.createDigitalRiverService('/customers/' + customerId);
    drCustomerSvc.setRequestMethod('GET');
    var callResult = drCustomerSvc.call();

    if (callResult.ok) {
        drCustomer = callResult.object || null;
        logger.info('Get Digital River customer data for the customer {0}', customerId);
    } else {
        logger.error('Error get Digital River customer data for the customer: {0}', JSON.stringify(callResult.errorMessage));
    }

    return drCustomer;
}

/**
 * Create a file on the Digital River side
 * @param {Object} payload - data to be uploaded
 * @returns {dw.svc.Result} - service result
 */
function createFile(payload) {
    var result = null;
    var serviceConfig = {
        parseResponse: function (svc, response) {
            if (response && svc.client.statusCode === 201) {
                try {
                    return JSON.parse(svc.client.text);
                } catch (e) {
                    return {
                        error: true,
                        errorMsg: 'Unable to parse response object ' + svc.client.text,
                        responseStr: svc.client.text
                    };
                }
            } else {
                return {
                    error: true,
                    errorMsg: 'Bad response'
                };
            }
        },
        createRequest: function (svc, args) {
            var Site = require('dw/system/Site');
            var HTTPRequestPart = require('dw/net/HTTPRequestPart');
            svc.addHeader('Accept', 'application/json');
            svc.setAuthentication('NONE');
            svc.addHeader('Authorization', 'Bearer ' + Site.current.getCustomPreferenceValue('drAPIKey'));
            svc.setRequestMethod('POST');
            var body = Object.keys(args).map(function (name) {
                return new HTTPRequestPart(name, args[name]);
            });
            return body;
        },
        executeOverride: true,
        execute: function (svc, args) {
            var httpClient = svc.getClient();
            return httpClient.sendMultiPart(args.toArray());
        }
    };
    var drUploadFileSvc = digitalRiver.createDigitalRiverService('/files', serviceConfig);
    var callResult = drUploadFileSvc.call(payload);

    if (callResult.ok) {
        result = callResult.object || null;
        logger.info('Send image of Tax Certificate {0}', payload.fileName);
    } else {
        logger.error('Error sending image of Tax Certificate: {0}', JSON.stringify(callResult.errorMessage));
    }
    return result;
}

/**
 * Retrieve stored cards from Digital River by souce ID
 * @param {string} sourceId - stored card source ID
 * @returns {Object} - stored card details
 */
function getSourceById(sourceId) {
    var result = null;
    var drSourcesSvc = digitalRiver.createDigitalRiverService('/sources/' + sourceId);
    drSourcesSvc.setRequestMethod('GET');

    logger.info('Sending API request to get source by ID {0}', sourceId);
    var callResult = drSourcesSvc.call();
    if (callResult.ok) {
        if (!empty(callResult.object)) {
            result = {
                sourceId: callResult.object.id,
                sourceClientSecret: callResult.object.clientSecret
            };
        } else {
            logger.error('Error get source by ID: {0}', JSON.stringify(callResult.errorMessage));
        }
    }

    return result;
}

/**
 * Creates source on the Digital River side
 * @param {Object} body - request body
 * @returns {dw.svc.Result} - service call result
 */
function createSource(body) {
    var drSourcesSvc = digitalRiver.createDigitalRiverService('/sources');
    logger.info('Sending request to create source to {0}', drSourcesSvc.getURL());
    var callResult = drSourcesSvc.call(body);
    if (callResult.ok) {
        logger.info('Source created: {0}', callResult.object.id);
    } else {
        logger.error('Error while creating source: {0}', JSON.stringify(callResult.errorMessage));
    }
    return callResult;
}

module.exports = {
    createCustomer: createCustomer,
    updateCustomer: updateCustomer,
    getCustomerById: getCustomerById,
    createFile: createFile,
    savePaymentToCustomer: savePaymentToCustomer,
    deletePaymentForCustomer: deletePaymentForCustomer,
    setCustomerDefaultPayment: setCustomerDefaultPayment,
    getSourceById: getSourceById,
    createSource: createSource
};
