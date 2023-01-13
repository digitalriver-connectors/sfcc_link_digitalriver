'use strict';

/**
 * @description Zero payment processor
 */

/**
 * @description Remove all payment instruments from the basket and create a new one
 * @param {dw.order.Basket} basket - Current users's basket
 * @returns {Object} Result object
 */
module.exports.Handle = function (basket) {
    var Transaction = require('dw/system/Transaction');
    var collections = require('*/cartridge/scripts/util/collections');
    var currentBasket = basket;

    Transaction.wrap(function () {
        var paymentInstruments = currentBasket.getPaymentInstruments();

        collections.forEach(paymentInstruments, function (item) {
            currentBasket.removePaymentInstrument(item);
        });

        currentBasket.createPaymentInstrument('DIGITAL_RIVER_ZERO_PAYMENT', currentBasket.totalGrossPrice);
    });

    return {
        fieldErrors: {},
        serverErrors: [],
        success: true
    };
};

/**
 * @description Authorizes a payment
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current payment method
 * @returns {Object} Result object
 */
module.exports.Authorize = function (orderNumber, paymentInstrument, paymentProcessor) {
    var Resource = require('dw/web/Resource');
    var Transaction = require('dw/system/Transaction');
    var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.checkout');
    var serverErrors = [];
    var error = false;

    try {
        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
        });
    } catch (err) {
        logger.error('Unable to Authorize zero payment: ' + err.message);

        error = true;
        serverErrors.push(
            Resource.msg('error.technical', 'checkout', null)
        );
    }

    return {
        fieldErrors: {},
        serverErrors: serverErrors,
        error: error
    };
};
