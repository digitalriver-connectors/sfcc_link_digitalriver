'use strict';

var parent = module.superModule;
var output = {};
Object.keys(parent).forEach(function (key) {
    output[key] = parent[key];
});

var Transaction = require('dw/system/Transaction');
var currentSite = require('dw/system/Site').getCurrent();
var dropInIsEnabled = currentSite.getCustomPreferenceValue('drUseDropInFeature');
var drReplacePromotions = currentSite.getCustomPreferenceValue('drReplacePromotions');

/**
 * Attempts to create an order from the current basket
 * @param {dw.order.Basket} currentBasket - The current basket
 * @returns {dw.order.Order} The order object created from the current basket
 */
output.createOrder = function (currentBasket) {
    var taxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
    var promotionNotes = [];
    if (dropInIsEnabled && drReplacePromotions) {
        Transaction.wrap(function () {
            // add tax promotion to the basket line items
            promotionNotes = taxHelper.updateTaxPromotion(currentBasket);
        });
    }

    var order = parent.createOrder.apply(this, arguments);

    // Save promotion to order notes
    if (order && promotionNotes.length > 0) {
        Transaction.wrap(function () {
            order.addNote('Applied promotions', JSON.stringify(promotionNotes));
        });
    }
    return order;
};

/**
 * Extends placeOrder function to finish Digital River checkout once order is placed
 * @param {dw.order.Order} order to be placed
 * @returns {Object} order placement status
 */
output.placeOrder = function (order) {
    if (!dropInIsEnabled) {
        return parent.placeOrder.apply(this, arguments);
    }

    var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
    var drOrderHelper = require('*/cartridge/scripts/digitalRiver/drOrderHelper');
    var OrderMgr = require('dw/order/OrderMgr');

    var checkoutId = order.custom.drCheckoutID;
    var result = { error: false };

    drCheckoutAPI.updateCheckout(checkoutId, { upstreamId: order.orderNo });

    var DRResult = drCheckoutAPI.createOrder(checkoutId);

    Transaction.wrap(function () {
        if (!DRResult.ok) {
            if (DRResult.error === 409) {
                drOrderHelper.handleConflictStatus(order, DRResult);
            }
            OrderMgr.failOrder(order, true);
            result.error = true;
        } else {
            if (order.custom.drCheckoutData) {
                var drCheckoutData = JSON.parse(order.custom.drCheckoutData);
                delete drCheckoutData.basketState;
                order.custom.drCheckoutData = JSON.stringify(drCheckoutData); // eslint-disable-line no-param-reassign
            }
            order.custom.drOrderID = DRResult.object.id; // eslint-disable-line no-param-reassign
            drOrderHelper.mapLineItemsWithDigitalRiver(order, DRResult.object.items);
            drOrderHelper.handleDigitalRiverOrderState(order, DRResult.object.state);

            // Wire transfer orders do not have fraud check
            var isWireTranferPaymentMethod = DRResult.object.payment.sources && DRResult.object.payment.sources.some(function (source) {
                return source.type === 'wireTransfer';
            });

            if (!isWireTranferPaymentMethod) {
                drOrderHelper.setFraudStatus(order, DRResult.object.fraudState);
            }

            if (!order.custom.drDropInResponse) {
                order.custom.drDropInResponse = 'No DropIn used for this checkout. Please, refer to \'Digital River order data\' order note'; // eslint-disable-line no-param-reassign
            }
            order.addNote('Digital River order payment data', JSON.stringify(DRResult.object.payment));
            delete DRResult.object.items; // Items deleted to reduce number of symbols due to Note limit. Clients are supposed to take information about items from order itself
            delete DRResult.object.payment; // Payment data added to separate Note due to Note limit
            order.addNote('Digital River order data', JSON.stringify(DRResult.object));
        }
    });

    if (result.error) {
        return result;
    }

    return parent.placeOrder.apply(this, arguments);
};

module.exports = output;
