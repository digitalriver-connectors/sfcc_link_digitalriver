'use strict';
/* globals response request*/

var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');
var URLUtils = require('dw/web/URLUtils');
var Site = require('dw/system/Site');
var ISML = require('dw/template/ISML');

var JOBTYPES = {
    onlyModifiedProducts: 'drStartDeltaJob',
    allProducts: 'drStartAllSkusJob'
};

/**
 * Shows Digital River Service tester bm page
 */
function Start() {
    ISML.renderTemplate('digitalriverbm/digitalriver');
}

/**
 * Sends test requests to API endpoints and returns the status
 */
function TestServices() {
    var resp = {};

    var drSkuAPI = require('*/cartridge/scripts/services/digitalRiverSKU');
    var testId = '1234567890';
    var bodySku = {
        eccn: 'EAR99',
        countryOfOrigin: 'US',
        taxCode: '4323.310_A',
        partNumber: '1234567890',
        name: 'Test Product',
        fulfill: false
    };

    var result = drSkuAPI.putSKU(testId, bodySku);
    if (result.ok || JSON.parse(result.errorMessage).type === 'conflict') {
        resp.sku = 'online';
    } else {
        resp.sku = 'offline';
    }

    var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
    var testEmail = '1234567890@digitalriver.com';

    var resultCheck = drCustomerAPI.createCustomer(testEmail);
    if (resultCheck.ok || JSON.parse(resultCheck.errorMessage).type === 'conflict') {
        resp.checkout = 'online';
    } else {
        resp.checkout = 'offline';
    }

    var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
    var checkoutBody = {
        sourceId: '',
        currency: 'USD',
        taxInclusive: false,
        browserIp: '111.111.111.111',
        email: 'null@digitalriver.com',
        shipTo: {
            address: {
                line1: '10380 Bren Road West',
                city: 'Minnetonka',
                postalCode: '55343',
                state: 'MN',
                country: 'US'
            },
            name: 'William Brown'
        },
        items: [
            {
                skuId: '1234567890',
                quantity: 3,
                price: 5.99,
                metadata: {
                    key1_LineLevel: '123456789'
                }
            }],
        upstreamId: '1234567890',
        metadata: {
            key1_OrderLevel: 12345,
            key2_OrderLevel: true
        }
    };
    var resultCust = drCheckoutAPI.createTestCheckout(checkoutBody);
    if (resultCust.ok || JSON.parse(resultCust.errorMessage).type === 'conflict') {
        resp.customer = 'online';
    } else {
        resp.customer = 'offline';
    }

    response.setContentType('application/json');
    response.writer.print(JSON.stringify({ response: resp }));
}

/**
 * Returns available action message for sending modified products job
 *
 * @param {string} jobType - type of job - site preference attribute name
 * @returns {string} action message
 */
var getActionMessage = function (jobType) {
    var isJobInProgress = Site.getCurrent().getCustomPreferenceValue(jobType);
    var actionMessageId = isJobInProgress ? 'dr.triggerjob.inprogress' : null;
    actionMessageId = actionMessageId || (jobType === JOBTYPES.allProducts ? 'dr.triggerjob.allproducts.start' : 'dr.triggerjob.start');
    var actionMessage = Resource.msg(actionMessageId, 'digitalriver', null);

    return actionMessage;
};


/**
 * Shows Trigger Delta Job Run page
 */
function ShowDeltaJobTrigger() {
    ISML.renderTemplate('digitalriverbm/triggerDeltaJob', {
        actionMessageModifiedProducts: getActionMessage(JOBTYPES.onlyModifiedProducts),
        actionMessageAllProducts: getActionMessage(JOBTYPES.allProducts),
        actionUrlModifiedProducts: URLUtils.url('DigitalRiver-TriggerDeltaSkuUpdateJob'),
        actionUrlAllProducts: URLUtils.url('DigitalRiver-TriggerAllSkusJob')
    });
}

/**
 * Switches site preference for job
 *
 * @param {string} jobType - type of job - site preference attribute name
 */
function triggerJob(jobType) {
    var currentSite = Site.getCurrent();
    var inProgressMessage = Resource.msg('dr.triggerjob.inprogress', 'digitalriver', null);
    var onlyVerify = request.httpParameterMap.actionMessage === inProgressMessage;
    if (!onlyVerify) {
        var isJobInProgress = currentSite.getCustomPreferenceValue(jobType);
        if (!isJobInProgress) {
            Transaction.wrap(function () {
                currentSite.setCustomPreferenceValue(jobType, true);
            });
        }
    }

    response.setContentType('application/json');
    response.writer.print(JSON.stringify({ actionMessage: getActionMessage(jobType) }));
}

/**
 * Switches site preference for job custom.scheduledDeltaSKU
 */
function TriggerDeltaSkuUpdateJob() {
    triggerJob(JOBTYPES.onlyModifiedProducts);
}

/**
 * Switches site preference for job custom.scheduledAllSKU
 */
function TriggerAllSkusJob() {
    triggerJob(JOBTYPES.allProducts);
}

module.exports.Start = Start;
exports.Start.public = true;

module.exports.TestServices = TestServices;
exports.TestServices.public = true;

module.exports.ShowDeltaJobTrigger = ShowDeltaJobTrigger;
exports.ShowDeltaJobTrigger.public = true;

module.exports.TriggerDeltaSkuUpdateJob = TriggerDeltaSkuUpdateJob;
exports.TriggerDeltaSkuUpdateJob.public = true;

module.exports.TriggerAllSkusJob = TriggerAllSkusJob;
exports.TriggerAllSkusJob.public = true;
