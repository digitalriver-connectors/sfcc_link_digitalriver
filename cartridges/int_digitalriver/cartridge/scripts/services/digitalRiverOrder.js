'use strict';

var digitalRiver = require('*/cartridge/scripts/services/digitalRiver');
var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.order');

/**
 * Sends API call to Digital River to retrieve placed orders
 * @param {Object} queryParams query parameters
 * @returns {dw.svc.Result} call result
 */
function getOrders(queryParams) {
    var drOrderService = digitalRiver.createDigitalRiverService('/orders');
    Object.keys(queryParams).forEach(function (key) {
        drOrderService.addParam(key, queryParams[key]);
    });
    drOrderService.setRequestMethod('GET');
    logger.info('Sending API request to retrieve orders to {0}', drOrderService.getURL());
    var callResult = drOrderService.call();
    if (callResult.ok) {
        logger.info('Orders successfully retrieved');
    } else {
        logger.error('Error while while retrieving orders: {0}', queryParams.ids);
    }
    return callResult;
}

/**
 * Sends API call to Digital River to retrieve placed order
 * @param {string} orderId dr order id
 * @returns {dw.svc.Result} call result
 */
function getOrder(orderId) {
    var drOrderService = digitalRiver.createDigitalRiverService('/orders/' + orderId);
    drOrderService.setRequestMethod('GET');
    logger.info('Sending API request to retrieve order to {0}', drOrderService.getURL());
    var callResult = drOrderService.call();
    if (callResult.ok) {
        logger.info('Order successfully retrieved');
    } else {
        logger.error('Error while while retrieving order: {0}', orderId);
    }
    return callResult;
}

/**
 * Sends API call to Digital River to create file link
 * @param {Object} body request body
 * @returns {dw.svc.Result} call result
 */
function createFileLink(body) {
    var drFileService = digitalRiver.createDigitalRiverService('/file-links');
    logger.info('Sending API request to create file link to {0}', drFileService.getURL());
    var callResult = drFileService.call(body);
    if (callResult.ok) {
        logger.info('File link successfully created');
    } else {
        logger.error('Error while while creating file link: {0}', body.fileId);
    }
    return callResult;
}

/**
 * Sends API call to Digital River to create fulfilments for an order
 * @param {Object} body request body
 * @returns {dw.svc.Result} call result
 */
function createFulfillment(body) {
    var drOrderService = digitalRiver.createDigitalRiverService('/fulfillments');
    drOrderService.setRequestMethod('POST');
    logger.info('Sending API request to post fulfilments to {0}', drOrderService.getURL());
    var callResult = drOrderService.call(body);
    if (callResult.ok) {
        logger.info('Fulfilments were successfully posted');
    } else if (callResult.error >= 500 && callResult.error < 600) {
        logger.info('Retrying the API call due to failure : Response Code {0} Response Message {1}', callResult.error, callResult.errorMessage);
        callResult = digitalRiver.drServiceRetryLogic(drOrderService, body, true);
    } else {
        logger.error('Error while while posting fulfilments for order {0}', body.orderId);
    }

    return callResult;
}

/**
* Sends API call to Digital River to retrieve refund detail for an orderId with pending information
* @param {string} orderId dr order id
* @returns {dw.svc.Result} call result
*/
function getRefunds(orderId) {
    var drOrderService = digitalRiver.createDigitalRiverService('/refunds?orderId=' + orderId + '&state=pending_information');
    drOrderService.setRequestMethod('GET');
    logger.info('Sending API request to retrieve order to {0}', drOrderService.getURL());
    var callResult = drOrderService.call();
    if (callResult.ok) {
        logger.info('Order successfully retrieved');
    } else {
        logger.error('Error while while retrieving order: {0}', orderId);
    }
    return callResult;
}

/**
* Retrieves refund details by refund ID from Digital River service
* @param {string} refundId - the ID of the refund
* @returns {Object} - the result of the API call to retrieve refund details
*/
function getRefundDetailsByRefundId(refundId) {
    var drOrderService = digitalRiver.createDigitalRiverService('/refunds/' + refundId);
    drOrderService.setRequestMethod('GET');
    logger.info('Sending API request to retrieve order to {0}', drOrderService.getURL());
    var callResult = drOrderService.call();
    if (callResult.ok) {
        logger.info('Order successfully retrieved');
    } else {
        logger.error('Error while while retrieving order: {0}', refundId);
    }
    return callResult;
}

/**
* Sends API call to Digital River to retrieve return portal url
* @param {string} drOrderId Digital River orderId
* @param {string} orderNumber salesforceOrderNumber
* @param {string} postalCode postal code of the shipping address
* @returns {dw.svc.Result} call result
*/
function getReturnPortalUrl(drOrderId, orderNumber, postalCode) {
    var drOrderService = digitalRiver.createDigitalRiverService('/global-returns/orders/create-return-portal-url?orderId=' + drOrderId + '&upstreamOrderId=' + orderNumber + '&postalCode=' + postalCode);
    drOrderService.setRequestMethod('GET');
    logger.info('Sending API request to get DR return portal url to {0}', drOrderService.getURL());
    var callResult = drOrderService.call();
    if (callResult.ok) {
        logger.info('Return portal url successfully retrieved');
    } else {
        logger.error('Error while while retrieving return portal url for order: {0}', drOrderId);
    }
    return callResult;
}

module.exports = {
    getOrders: getOrders,
    getOrder: getOrder,
    createFileLink: createFileLink,
    createFulfillment: createFulfillment,
    getRefunds: getRefunds,
    getRefundDetailsByRefundId: getRefundDetailsByRefundId,
    getReturnPortalUrl: getReturnPortalUrl
};
