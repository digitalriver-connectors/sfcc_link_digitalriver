'use strict';

var OrderMgr = require('dw/order/OrderMgr');
var logger = require('../digitalRiver/drLogger').getLogger('digitalriver.order');
var drStates = require('../digitalRiver/drCustomStates.json');

var Status = require('dw/system/Status');

var MAX_ORDERS_PER_REQUEST = 20; // 20 is a maximum quantity of orders that can be retrieved from Digital River per request
request.custom.isJobRequest = true;

/**
 * Compares two orders by their natural order
 * @param {dw.order.Order} order1 order to compare
 * @param {dw.order.Order} order2 order to compare
 * @returns {number} order position
 */
function compareOrders(order1, order2) {
    if (order1.custom.drOrderID && order2.custom.drOrderID) {
        if (order1.custom.drOrderID < order2.custom.drOrderID) {
            return -1;
        }
        if (order1.custom.drOrderID > order2.custom.drOrderID) {
            return 1;
        }
    }
    return 0;
}

/**
 * Performs orders binary search by Digital River order id.
 * @param {array} ordersArray source orders
 * @param {string} digitalRiverId Digital River Id to be found
 * @returns {number} index of order which has target Digital River order id
 */
function findOrder(ordersArray, digitalRiverId) {
    var min = 0;
    var max = ordersArray.length - 1;

    while (min <= max) {
        var mid = Math.floor((min + max) / 2);
        var currentOrderDrId = ordersArray[mid].custom.drOrderID;
        if (currentOrderDrId === digitalRiverId) {
            return mid;
        }
        if (currentOrderDrId < digitalRiverId) {
            min = mid + 1;
        }
        if (currentOrderDrId > digitalRiverId) {
            max = mid - 1;
        }
    }
    return -1;
}

/**
 * Sends request to get Digital River orders relevant for provided orders collection and updates all orders according to latest Digital River status.
 * @param {array} ordersArray collection of dw.order.Order
 * @returns {dw.system.Status} job result status
 */
function handleOrderUpdates(ordersArray) {
    var drOrderAPI = require('*/cartridge/scripts/services/digitalRiverOrder');
    var drOrderHelper = require('*/cartridge/scripts/digitalRiver/drOrderHelper');
    var Transaction = require('dw/system/Transaction');

    var udpateStatus = new Status(Status.OK);
    ordersArray.sort(compareOrders);
    var params = {};
    params.limit = MAX_ORDERS_PER_REQUEST;
    params.ids = ordersArray
        .map(function (order) { return order.custom.drOrderID; })
        .join(',');
    try {
        var callResult = drOrderAPI.getOrders(params);
        if (!callResult.ok) {
            return new Status(Status.ERROR);
        }
        if (callResult.object.data.length < ordersArray.length) { // backup for scenario that should never happen
            var requestedOrders = ordersArray.map(function (order) { return order.custom.drOrderID; });
            var retrievedOrders = callResult.object.data.map(function (order) { return order.id; });
            var missingOrders = requestedOrders
                .filter(function (orderId) {
                    return retrievedOrders.every(function (drOrderID) { return orderId !== drOrderID; });
                })
                .join(', ');
            logger.error('Not all requested orders were retrieved. Missing orders:' + missingOrders);
            udpateStatus = new Status(Status.ERROR);
        }
        Transaction.wrap(function () {
            callResult.object.data.forEach(function (drOrder) {
                var index = findOrder(ordersArray, drOrder.id);
                if (index < 0) {
                    logger.error('Order with drOrderID ' + drOrder.id + ' wasn\'t found in current orders collection');
                    udpateStatus = new Status(Status.ERROR);
                } else {
                    drOrderHelper.handleDigitalRiverOrderState(ordersArray[index], drOrder.state);
                    if (drOrder.fraudState) { // completed orders do not have fraudState
                        drOrderHelper.setFraudStatus(ordersArray[index], drOrder.fraudState);
                    }
                }
            });
        });
    } catch (e) {
        logger.error(e.message);
        return new Status(Status.ERROR);
    }
    return udpateStatus;
}

/**
 * Returns a array representing a subsequence within the iterator
 * @param {dw.util.SeekableIterator} ordersSeekIterator - SeekableIterator with Orders
 * @param {number} size -  the number of items to collect
 * @returns {array} - array of orders
 */
function getNextCountFromIterator(ordersSeekIterator, size) {
    var result = [];
    var counter = 1;
    while (ordersSeekIterator.hasNext() && counter < size) {
        counter += 1;
        result.push(ordersSeekIterator.next());
    }
    return result;
}

/**
 * Queries all orders with transitional Digital River Status, requests those from DR by ids and updates according to status changes
 * @returns {dw.system.Status} job result status
 */
function updatePendingOrders() {
    var overallStatus = new Status(Status.OK);
    var ordersIterator = OrderMgr.searchOrders(
        '(custom.drOrderID != NULL AND (custom.drOrderStatus = {0} OR custom.drOrderStatus = {1} OR custom.drOrderStatus = {2}))',
        null,
        drStates.ORDER_STATE_ON_FRAUD_REVIEW,
        drStates.ORDER_STATE_ON_PAYMENT_REVIEW,
        drStates.ORDER_STATE_FULFILLED
    );

    while (ordersIterator.hasNext()) {
        var ordersToUpdate = getNextCountFromIterator(ordersIterator, MAX_ORDERS_PER_REQUEST);
        var handleStatus = handleOrderUpdates(ordersToUpdate);
        if (handleStatus.isError()) {
            overallStatus = handleStatus;
        }
    }

    ordersIterator.close();
    return overallStatus;
}

/**
 * Queries all orders that are cancelled or completed on SFCC side but still have 'accepted' Digital River status.
 * Requests those from DR by ids and updates according to status changes
 * @returns {dw.system.Status} job result status
 */
function completeFulfilledOrders() {
    var Order = require('dw/order/Order');

    var overallStatus = new Status(Status.OK);
    var ordersIterator = OrderMgr.searchOrders(
        '(custom.drOrderID != NULL AND (shippingStatus = {0} AND custom.drOrderStatus = {1}) OR (status = {2} AND custom.drOrderStatus = {1}))',
        null,
        Order.SHIPPING_STATUS_SHIPPED,
        drStates.ORDER_STATE_ACCEPTED,
        Order.ORDER_STATUS_CANCELLED
    );

    while (ordersIterator.hasNext()) {
        var ordersToUpdate = getNextCountFromIterator(ordersIterator, MAX_ORDERS_PER_REQUEST);
        var handleStatus = handleOrderUpdates(ordersToUpdate);
        if (handleStatus.isError()) {
            overallStatus = handleStatus;
        }
    }

    ordersIterator.close();
    return overallStatus;
}

/**
 * Queries all orders that are cancelled or completed on SFCC side but still have 'accepted' Digital River status.
 * Requests those from DR by ids and updates according to status changes
 * @returns {dw.system.Status} job result status
 */
function fulfillOrders() {
    var Order = require('dw/order/Order');
    var drOrderHelper = require('*/cartridge/scripts/digitalRiver/drOrderHelper');

    var overallStatus = new Status(Status.OK);
    var ordersToUpdate = [];

    // Step 1 - create fulfillments for all cancelled or fulfilled orders
    var callback = function (order) {
        var items = order.getAllProductLineItems().toArray();
        var result = { ok: false };

        if (!Object.prototype.hasOwnProperty.call(order.custom, 'drOrderID')) {
            logger.warn('Order {0} was skipped. Reason: custom.drOrderID field is empty/missing', order.getOrderNo());
            return;
        }
        if (order.shippingStatus.value === Order.SHIPPING_STATUS_SHIPPED) {
            result = drOrderHelper.notifyOrderFulfillment(order, items);
        } else if (order.status.value === Order.ORDER_STATUS_CANCELLED) {
            result = drOrderHelper.notifyOrderCancellation(order, items);
        }
        if (!result.ok) {
            logger.error('Digital River fulfillment was not created for order {0}', order.getOrderNo());
            overallStatus = new Status(Status.ERROR);
        }
        ordersToUpdate.push(order);
    };

    var orderIterator = OrderMgr.searchOrders(
        '(custom.drOrderID != NULL AND (shippingStatus = {0} AND custom.drOrderStatus = {1}) OR (status = {2} AND custom.drOrderStatus = {1}))',
        null,
        Order.SHIPPING_STATUS_SHIPPED,
        drStates.ORDER_STATE_ACCEPTED,
        Order.ORDER_STATUS_CANCELLED
    );
    while (orderIterator.hasNext()) {
        callback(orderIterator.next());
    }
    orderIterator.close();

    // Step 2 - update order statuses for all processed orders
    var cursor = 0;
    while (cursor <= ordersToUpdate.length - 1) {
        var handleStatus = handleOrderUpdates(ordersToUpdate.slice(cursor, cursor + MAX_ORDERS_PER_REQUEST));
        if (handleStatus.isError()) {
            overallStatus = handleStatus;
        }
        cursor += MAX_ORDERS_PER_REQUEST;
    }

    return overallStatus;
}

/**
 * Get tax details in item.metadata by type and returns string.
 * @param {string} taxType tax detail type, productTaxDetail or shippingTaxDetail
 * @param {array} metadata metadata array from DR order
 * @returns {string} tax details results
 */
function getTaxDetail(taxType, metadata) {
    var keys = Object.keys(metadata).sort().filter(k => k.startsWith(taxType));
    if (keys.length === 0) { return null; }
    var taxData = {};
    taxData[taxType] = [];
    keys.forEach(k => {
        taxData[taxType].push(metadata[k]);
    });
    return JSON.stringify(taxData);
}

/**
 * Updates the tax details of the lineitems in the order.
 * @param {array} ordersArray collection of dw.order.Order
 * @returns {dw.system.Status} job result status
 */
function handleDRTaxDetailsUpdates(ordersArray) {
    var drOrderAPI = require('*/cartridge/scripts/services/digitalRiverOrder');
    var Transaction = require('dw/system/Transaction');

    var udpateStatus = new Status(Status.OK);
    ordersArray.sort(compareOrders);
    var params = {};
    params.limit = MAX_ORDERS_PER_REQUEST;
    params.ids = ordersArray
        .map(function (order) { return order.custom.drOrderID; })
        .join(',');
    try {
        var callResult = drOrderAPI.getOrders(params);
        if (!callResult.ok) {
            return new Status(Status.ERROR);
        }
        if (callResult.object.data.length < ordersArray.length) { // backup for scenario that should never happen
            var requestedOrders = ordersArray.map(function (order) { return order.custom.drOrderID; });
            var retrievedOrders = callResult.object.data.map(function (order) { return order.id; });
            var missingOrders = requestedOrders
                .filter(function (orderId) {
                    return retrievedOrders.every(function (drOrderID) { return orderId !== drOrderID; });
                })
                .join(', ');
            logger.error('Not all requested orders were retrieved. Missing orders:' + missingOrders);
            udpateStatus = new Status(Status.ERROR);
        }
        Transaction.wrap(function () {
            callResult.object.data.forEach(function (drOrder) {
                var index = findOrder(ordersArray, drOrder.id);
                if (index < 0) {
                    logger.error('Order with drOrderID ' + drOrder.id + ' wasn\'t found in current orders collection');
                    udpateStatus = new Status(Status.ERROR);
                } else {
                    var order = ordersArray[index];
                    if (Object.hasOwnProperty.call(drOrder, 'metadata') && Object.hasOwnProperty.call(drOrder.metadata, 'td_process')) {
                        if (drOrder.totalTax > 0) {
                            var lineItems = order.getAllProductLineItems().toArray();
                            drOrder.items.forEach(function (drItem) {
                                if (Object.hasOwnProperty.call(drItem, 'metadata')) {
                                    var item = lineItems.find(li => li.custom.digitalRiverID === drItem.id);
                                    item.custom.drTaxDetail = getTaxDetail('productTaxDetail', drItem.metadata);
                                    item.custom.drShippingTaxDetail = getTaxDetail('shippingTaxDetail', drItem.metadata);
                                }
                            });
                        }
                        order.custom.isDRTaxDetailPopulated = true;
                    } else {
                        order.custom.isDRTaxDetailPopulated = false;
                    }
                }
            });
        });
    } catch (e) {
        logger.error(e.message);
        return new Status(Status.ERROR);
    }
    return udpateStatus;
}

/**
 * Queries all orders that need tax details populated, requests those orders from DR by ids and updates the tax details of those orders if tax details are present in the DR order metadata.
 * @returns {dw.system.Status} job result status
 */
function updateDRTaxDetailsForOrders() {
    var overallStatus = new Status(Status.OK);
    var ordersIterator = OrderMgr.searchOrders(
        '(custom.drOrderID != NULL AND (custom.drOrderStatus = {0} OR custom.drOrderStatus = {1} OR custom.drOrderStatus = {2}) AND (custom.isDRTaxDetailPopulated = NULL OR custom.isDRTaxDetailPopulated = false))',
        null,
        drStates.ORDER_STATE_ACCEPTED,
        drStates.ORDER_STATE_FULFILLED,
        drStates.ORDER_STATE_COMPLETED
    );

    while (ordersIterator.hasNext()) {
        var ordersToUpdate = getNextCountFromIterator(ordersIterator, MAX_ORDERS_PER_REQUEST);
        var handleStatus = handleDRTaxDetailsUpdates(ordersToUpdate);
        if (handleStatus.isError()) {
            overallStatus = handleStatus;
        }
    }

    ordersIterator.close();
    return overallStatus;
}

module.exports = {
    updatePendingOrders: updatePendingOrders,
    completeFulfilledOrders: completeFulfilledOrders,
    fulfillOrders: fulfillOrders,
    updateDRTaxDetailsForOrders: updateDRTaxDetailsForOrders
};
