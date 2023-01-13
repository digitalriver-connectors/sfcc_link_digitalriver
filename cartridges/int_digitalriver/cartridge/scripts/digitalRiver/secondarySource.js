'use strict';

var BasketMgr = require('dw/order/BasketMgr');
var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');
var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
var collections = require('*/cartridge/scripts/util/collections');

/**
 * Gets amount remaining to be contributed
 * @param {string} drCheckoutID current order
 * @returns {number} amount remaining to be contributed
 */
function getAmountRemainingToBeContributed(drCheckoutID) {
    var getCheckoutResult = drCheckoutAPI.getCheckout(drCheckoutID);
    var amountRemainingToBeContributed = null;

    if (getCheckoutResult.ok) {
        amountRemainingToBeContributed = getCheckoutResult.object.payment.session.amountRemainingToBeContributed;
    }

    return amountRemainingToBeContributed;
}

/**
 * Creates customer credit source
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument payment instrument
 * @param {number} customerCreditAmount customer credit amount
 * @returns {Object} object with source id or error message
 */
function createCustomerCreditSource(paymentInstrument, customerCreditAmount) {
    var currentBasket = BasketMgr.getCurrentBasket();
    var drCheckoutID = currentBasket.custom.drCheckoutID;
    var drPaymentSessionId = currentBasket.custom.drPaymentSessionId;
    var amountRemainingToBeContributed = getAmountRemainingToBeContributed(drCheckoutID);

    if (customerCreditAmount > 0 && customerCreditAmount <= amountRemainingToBeContributed) {
        var body = {
            type: 'customerCredit',
            amount: customerCreditAmount,
            paymentSessionId: drPaymentSessionId,
            customerCredit: {}
        };
        var callResult = drCustomerAPI.createSource(body);
        if (callResult.ok) {
            Transaction.wrap(function () {
                paymentInstrument.custom.drSourceId = callResult.object.id; // eslint-disable-line no-param-reassign
            });
            return {
                success: true,
                sourceId: callResult.object.id
            };
        }
    }

    Transaction.wrap(function () {
        currentBasket.removePaymentInstrument(paymentInstrument);
    });

    return {
        error: true,
        errorMessage: Resource.msg('msg.error.customercredit.invalidamount', 'digitalriver', null)
    };
}

/**
 * Removes customer credit source from checkout
 * @param {string} checkoutId DR checkout id
 * @param {string} sourceId customer credit source id
 * @returns {boolean} whether customer credit source was successfully removed or not
 */
function removeCustomerCreditSource(checkoutId, sourceId) {
    var currentBasket = BasketMgr.getCurrentBasket();
    var paymentInstruments = currentBasket.getPaymentInstruments();
    var deleteResult = drCheckoutAPI.deleteSource(checkoutId, sourceId);

    if (deleteResult.ok) {
        var customerCreditSourcePI = collections.find(paymentInstruments, function (paymentInstrument) {
            return paymentInstrument.custom.drSourceId === sourceId;
        });
        Transaction.wrap(function () {
            currentBasket.removePaymentInstrument(customerCreditSourcePI);
        });
        return true;
    }

    return false;
}

module.exports = {
    createCustomerCreditSource: createCustomerCreditSource,
    removeCustomerCreditSource: removeCustomerCreditSource
};
