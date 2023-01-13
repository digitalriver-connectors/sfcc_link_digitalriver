'use strict';

var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.order');
var drStates = require('*/cartridge/scripts/digitalRiver/drCustomStates.json');
var Order = require('dw/order/Order');
var OrderMgr = require('dw/order/OrderMgr');

/**
 * Sets order payment status as paid. Unfreezes order if it had any of transitional Digital River states.
 * Copies Digital River order state to custom property.
 * @param {dw.order.Order} order current order
 */
function acceptOrder(order) {
    if (order.custom.drOrderStatus) { // order may already have some transitional status, this means that order is not confirmed and blocked from exporting
        order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
        order.setExportStatus(Order.EXPORT_STATUS_READY);
    }
    order.custom.drOrderStatus = drStates.ORDER_STATE_ACCEPTED; // eslint-disable-line no-param-reassign
}
/**
 * Updates order statuses so that the order would not be processed or exported.
 * Copies Digital River order state to custom property.
 * @param {dw.order.Order} order current order
 * @param {string} digitalRiverState order state returned by Digital River
 */
function freezeOrder(order, digitalRiverState) {
    order.setConfirmationStatus(Order.CONFIRMATION_STATUS_NOTCONFIRMED);
    order.setExportStatus(Order.EXPORT_STATUS_NOTEXPORTED);
    order.custom.drOrderStatus = digitalRiverState; // eslint-disable-line no-param-reassign
}

/**
 * Cancels order
 * Copies Digital River order state to custom property.
 * @param {dw.order.Order} order order to be canceled
 * @param {string} digitalRiverState order state returned by Digital River
 */
function cancelOrder(order, digitalRiverState) {
    order.custom.drOrderStatus = digitalRiverState; // eslint-disable-line no-param-reassign
    OrderMgr.cancelOrder(order);
}

/**
 * Fail order
 * Copies Digital River order state to custom property.
 * @param {dw.order.Order} order order to be failed
 * @param {string} digitalRiverState order state returned by Digital River
 */
function failOrder(order, digitalRiverState) {
    order.custom.drOrderStatus = digitalRiverState; // eslint-disable-line no-param-reassign
    OrderMgr.failOrder(order, true);
}

/**
 * Completes the order
 * @param {dw.order.Order} order order to be canceled
 */
function completeOrder(order) {
    order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
    order.setStatus(Order.ORDER_STATUS_COMPLETED); // eslint-disable-line no-param-reassign
    order.custom.drOrderStatus = drStates.ORDER_STATE_COMPLETED; // eslint-disable-line no-param-reassign
}

/**
 * Fulfills the order
 * @param {dw.order.Order} order order to be fulfilled
 */
function fulfillOrder(order) {
    order.custom.drOrderStatus = drStates.ORDER_STATE_FULFILLED; // eslint-disable-line no-param-reassign
}

/**
 * Sets order custom property drOrderStatus according to response from Digital River
 * @param {dw.order.Order} order to be handled
 * @param {string} state order state returned by Digital River
 */
function handleDigitalRiverOrderState(order, state) {
    if (order.custom.drOrderStatus === state) {
        return;
    }
    switch (state) {
        case drStates.ORDER_STATE_ACCEPTED:
            acceptOrder(order); break;
        case drStates.ORDER_STATE_BLOCKED:
            failOrder(order, drStates.ORDER_STATE_BLOCKED); break;
        case drStates.ORDER_STATE_CHARGE_FAILED:
            failOrder(order, drStates.ORDER_STATE_CHARGE_FAILED); break;
        case drStates.ORDER_STATE_ON_PAYMENT_REVIEW:
            freezeOrder(order, drStates.ORDER_STATE_ON_PAYMENT_REVIEW); break;
        case drStates.ORDER_STATE_ON_FRAUD_REVIEW:
            freezeOrder(order, drStates.ORDER_STATE_ON_FRAUD_REVIEW); break;
        case drStates.ORDER_STATE_CANCELLED:
            cancelOrder(order, drStates.ORDER_STATE_CANCELLED); break;
        case drStates.ORDER_STATE_COMPLETED:
            completeOrder(order); break;
        case drStates.ORDER_STATE_FULFILLED:
            fulfillOrder(order); break;
        default:
            logger.error('Unexpected order state for order {0}: {1}', order.getOrderNo(), state);
    }
}

/**
 * Sets order custom property drFraudStatus according to response from Digital River
 * @param {dw.order.Order} order current order to be updated
 * @param {string} state fraud state returned by Digital River
 */
function setFraudStatus(order, state) {
    var stateToBeSet;
    switch (state) {
        case drStates.FRAUD_STATUS_PASSED:
            stateToBeSet = drStates.FRAUD_STATUS_PASSED; break;
        case drStates.FRAUD_STATUS_BLOCKED:
            stateToBeSet = drStates.FRAUD_STATUS_BLOCKED; break;
        case drStates.FRAUD_STATUS_REVIEW_OPENED:
            stateToBeSet = drStates.FRAUD_STATUS_REVIEW_OPENED; break;
        default:
            logger.error('Unexpected order state: {0}', state);
    }
    order.custom.drFraudStatus = stateToBeSet; // eslint-disable-line no-param-reassign
}

/**
 * Updates order statuses in scenarios when Digital River returns status 409 instead of 201
 * @param {dw.order.Order} order current order
 * @param {dw.svc.Result} drResult DigitalRiver call result
 */
function handleConflictStatus(order, drResult) {
    try {
        var errorData = JSON.parse(drResult.errorMessage);
        var drErrorCode = errorData.errors[0].code;
        request.custom.isDrConflictError = true; // eslint-disable-line no-undef
        switch (drErrorCode) {
            case 'failed-request':
                handleDigitalRiverOrderState(order, drStates.ORDER_STATE_CHARGE_FAILED);
                setFraudStatus(order, drStates.FRAUD_STATUS_PASSED);
                break;
            case 'order-fraud-failure':
                handleDigitalRiverOrderState(order, drStates.ORDER_STATE_BLOCKED);
                setFraudStatus(order, drStates.FRAUD_STATUS_BLOCKED);
                break;
            default:
                logger.error('Unexpected conflict error code {0}', drErrorCode);
        }
    } catch (e) {
        logger.error('Failed to handle Digital River conflict response {0}', drResult.errorMessage);
    }
}


/**
 * Saves to product lines custom attributes ids of relevant items on Digital River side
 * @param {dw.order.Order} order current order
 * @param {array} drItems array of Digial River items object
 */
function mapLineItemsWithDigitalRiver(order, drItems) {
    var lineItems = order.getAllProductLineItems() // collects all pli's into a digitalRiverID - lineItem map
        .toArray()
        .reduce(function (result, item) {
            result[item.custom.digitalRiverID] = item; // eslint-disable-line no-param-reassign
            return result;
        }, {});
    drItems.forEach(function (drItem) {
        var sfccItem = lineItems[drItem.metadata.crossCheckoutId];
        sfccItem.custom.digitalRiverID = drItem.id; // replace temporary Digital River id with actual DR item id which is finalized after order is placed
        if (Object.hasOwnProperty.call(drItem, 'fees')) {
            sfccItem.custom.drFeeAmount = drItem.fees.amount;
            sfccItem.custom.drFeeTaxAmount = drItem.fees.taxAmount;
            sfccItem.custom.drFeeDetails = JSON.stringify(drItem.fees.details);
        }
    });
}

/**
 * Filters out product line items that do not refer to Digital River items
 * Selects requested line items for partial fulfillment cases
 * @param {dw.order.Order} order current order
 * @param {array} items line items or line item ids provided in request
 * @returns {array} of line items
 */
function filterLineItems(order, items) {
    var lineItemsArray;
    var itemsToFilter;
    if (!items || typeof items[0] === 'string') {
        lineItemsArray = order.getAllProductLineItems().toArray();
        itemsToFilter = items;
    } else {
        lineItemsArray = items;
        itemsToFilter = null;
    }

    return lineItemsArray
        .filter(function (lineItem) {
            var requestedToBeFulfilled = itemsToFilter // if this is partial fulfillment, select only line items provided in request
                ? itemsToFilter.some(function (item) { return item === lineItem.getUUID(); })
                : true; // if no items provided then all relevant line items selected
            return lineItem.custom.digitalRiverID && requestedToBeFulfilled;
        });
}

/**
 * creates Fullfillment and sends to Digital River
 * @param {number|Object} order current order or order number
 * @param {Array} [items] array of line items ids for partial fulfillment
 * @returns {Object} result of Digital River create fulfillment call
 */
function notifyOrderFulfillment(order, items) {
    var drOrderAPI = require('*/cartridge/scripts/services/digitalRiverOrder');

    var lineItemsToSend = filterLineItems(order, items); // if items were provided as ids select those that were requested and have digitalRiverID
    var itemsDRformat = lineItemsToSend.map(function (lineItem) {
        return {
            itemId: lineItem.custom.digitalRiverID,
            quantity: lineItem.getQuantityValue()
        };
    });

    var drOrderId = order.custom.drOrderID;
    if (!drOrderId) {
        logger.error('Order {0} has no Digital River id', order.getOrderNo());
    }
    var i;
    var body;
    var result;
    var mapOfLineItems = new Map();    // stores "drTrackingNumber" as a key and body as a value

    for (i = 0; i < lineItemsToSend.length; i++) {
        var drTrackingCompany = lineItemsToSend[i].custom.drTrackingCompany;
        var drTrackingNumber = lineItemsToSend[i].custom.drTrackingNumber;
        var drTrackingUrl = lineItemsToSend[i].custom.drTrackingUrl;

        if (!drTrackingNumber) {         // checking whether tracking number is empty
            drTrackingNumber = null;
        }

        var itemsList = [];
        if (mapOfLineItems.has(drTrackingNumber)) {
            itemsList = mapOfLineItems.get(drTrackingNumber).items;
        }
        itemsList.push(itemsDRformat[i]);
        body = {
            orderId: drOrderId,
            items: itemsList,
            trackingCompany: drTrackingCompany,
            trackingNumber: drTrackingNumber,
            trackingUrl: drTrackingUrl
        };
        mapOfLineItems.set(drTrackingNumber, body);
    }

    mapOfLineItems.forEach(function (value) {
        result = drOrderAPI.createFulfillment(value);
    });

    return result;
}

/**
 * creates cancellation Fullfillment and sends to Digital River
 * @param {number|Object} order current order or order number
 * @param {Array} [items] array of line items ids for partial cancellation
 * @returns {Object} result of Digital River create fulfillment call
 */
function notifyOrderCancellation(order, items) {
    var drOrderAPI = require('*/cartridge/scripts/services/digitalRiverOrder');

    var lineItemsToSend = filterLineItems(order, items); // if items were provided as ids select those that were requested and have digitalRiverID
    var itemsDRformat = lineItemsToSend.map(function (lineItem) {
        return {
            itemId: lineItem.custom.digitalRiverID,
            cancelQuantity: lineItem.getQuantityValue()
        };
    });

    var body = {
        orderId: order.custom.drOrderID,
        items: itemsDRformat
    };

    return drOrderAPI.createFulfillment(body);
}


module.exports = {
    handleDigitalRiverOrderState: handleDigitalRiverOrderState,
    setFraudStatus: setFraudStatus,
    handleConflictStatus: handleConflictStatus,
    mapLineItemsWithDigitalRiver: mapLineItemsWithDigitalRiver,
    notifyOrderFulfillment: notifyOrderFulfillment,
    notifyOrderCancellation: notifyOrderCancellation
};
