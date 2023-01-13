'use strict';

/*
    @IG:
    This processor was added for testing and used as a payment processor for GIFT_CERTIFICATE payment method since SFRA does not natively support gift certificates.
    Delete or modify it depending on your implementation of secondary payments
*/

/**
 * Authorizes a payment using a gift certificate.
 * @param {string} orderNumber orderNumber
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument paymentInstrument
 * @param {dw.order.PaymentProcessor} paymentProcessor paymentProcessor
 * @returns {Object} result
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var Transaction = require('dw/system/Transaction');

    Transaction.begin();
    paymentInstrument.paymentTransaction.transactionID = orderNumber; // eslint-disable-line no-param-reassign
    paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor; // eslint-disable-line no-param-reassign
    Transaction.commit();

    return { authorized: true };
}

exports.Authorize = Authorize;
