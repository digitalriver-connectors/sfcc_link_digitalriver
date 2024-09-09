'use strict';

const CustomObjectMgr = require('dw/object/CustomObjectMgr');
const Transaction = require('dw/system/Transaction');
const drOrderHelper = require('*/cartridge/scripts/digitalRiver/drOrderHelper');
const Site = require('dw/system/Site');
const Status = require('dw/system/Status');
const Logger = require('dw/system/Logger');
const logger = Logger.getLogger('drCancelAbandonedOrdersJob');

let queriedCustomObjects;
let cancellableStates;
let drOrdersObject = {};
let queriedCustomObjectsArray = [];
let upstreamIds = [];

exports.beforeStep = function () {
    cancellableStates = Site.getCurrent().getCustomPreferenceValue('drCancellableStates');
    queriedCustomObjects = CustomObjectMgr.queryCustomObjects('DROrderCancellationOnErrorRequest', 'custom.isOrderCancellationInitiated = {0}', 'creationDate asc', false);
};

exports.getTotalCount = function () {
    if (queriedCustomObjects) {
        let totalCancellationRequestsCount = queriedCustomObjects.count;
        logger.info('Total cancellation requests count: {0}', totalCancellationRequestsCount);
        return totalCancellationRequestsCount;
    }
    return 0;
};

exports.read = function () {
    if (queriedCustomObjects && queriedCustomObjects.hasNext()) {
        let cancellationRequest = queriedCustomObjects.next();
        queriedCustomObjectsArray.push(cancellationRequest);
        return cancellationRequest;
    }
    return null;
};

exports.process = function (cancellationRequest) {
    if (cancellationRequest && cancellationRequest.custom) {
        upstreamIds.push(cancellationRequest.custom.basketID);
        return cancellationRequest;
    }
    return null;
};

exports.write = function (cancellationRequests) {
    if (cancellationRequests) {
        var getOrdersCallResult = drOrderHelper.getOrdersByUpstreamId(upstreamIds);
        if (getOrdersCallResult.ok) {
            var drOrders = getOrdersCallResult.object.data;
            cancellationRequests.toArray().forEach(function (cancellationRequest) {
                drOrders = drOrders.filter(function (drOrder) {
                    var status = false;
                    if (drOrder.checkoutId === cancellationRequest.custom.digitalRiverCheckoutID) {
                        drOrdersObject[drOrder.id] = drOrder;
                        // eslint-disable-next-line no-loop-func
                        Transaction.wrap(function () {
                            cancellationRequest.custom.digitalRiverOrderID = drOrder.id; // eslint-disable-line no-param-reassign
                            cancellationRequest.custom.digitalRiverOrderState = drOrder.state; // eslint-disable-line no-param-reassign
                        });
                        logger.info('[INFO] Order cancellation request custom object has been updated with up-to-date values for Digital River order: ' + drOrder.id);
                    } else {
                        status = true;
                    }
                    return status;
                });
                if (cancellationRequest && cancellationRequest.custom && cancellableStates.indexOf(cancellationRequest.custom.digitalRiverOrderState) > -1) {
                    let drOrder = drOrdersObject[cancellationRequest.custom.digitalRiverOrderID];
                    if (drOrder) {
                        let cancellationCallResult = drOrderHelper.notifyAbandonedOrderCancellation(drOrder);
                        if (cancellationCallResult.ok) {
                            Transaction.wrap(function () {
                                cancellationRequest.custom.isOrderCancellationInitiated = true; // eslint-disable-line no-param-reassign
                            });
                            logger.info('[INFO] Order cancellation has been initiated for Digital River order: ' + drOrder.id);
                        } else {
                            logger.error('[ERROR] Failed to cancel order: ' + drOrder.id + ' with error: ' + cancellationCallResult.errorMessage);
                        }
                    }
                }
            });
        } else {
            logger.error('[ERROR] Failed to get orders by upstream ids: ' + JSON.stringify(upstreamIds) + ' with error: ' + getOrdersCallResult.errorMessage);
        }
    }
    upstreamIds = [];
};

exports.afterStep = function () {
    let cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() - Site.getCurrent().getCustomPreferenceValue('drOrderCancellationCORetentionDays'));
    let cleanupQuery = CustomObjectMgr.queryCustomObjects('DROrderCancellationOnErrorRequest', 'creationDate < {0}', 'creationDate asc', cleanupDate);
    while (cleanupQuery.hasNext()) {
        let oldCancellationRequest = cleanupQuery.next();
        if (oldCancellationRequest && oldCancellationRequest.custom) {
            let drOrderID = oldCancellationRequest.custom.digitalRiverOrderID;
            // eslint-disable-next-line no-loop-func
            Transaction.wrap(function () {
                CustomObjectMgr.remove(oldCancellationRequest);
            });
            logger.info('[INFO] Expired cancellation request custom object for the Digital River order: ' + drOrderID + '  has been removed.');
        }
    }
    return new Status(Status.OK, null, 'Process finished for cancellation requests.');
};
