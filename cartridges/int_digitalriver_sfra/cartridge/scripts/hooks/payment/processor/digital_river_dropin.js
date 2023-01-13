'use strict';

/* API Includes */
var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');
var Money = require('dw/value/Money');
/**
 * Digital River DropIn handler
 *
 * @param {Object} basket - the basket to be processed
 * @param {Object} paymentInformation - the payment information object
 * @param {string} paymentMethodID - the payment method ID
 * @param {Object} req - request object
 * @returns {Object} Status object
 */
function Handle(basket, paymentInformation, paymentMethodID, req) { // eslint-disable-line no-unused-vars
    var fieldErrors = [];
    var serverErrors = [];
    try {
        var currentBasket = basket;
        Transaction.wrap(function () {
            var collections = require('*/cartridge/scripts/util/collections');

            var paymentInstruments = currentBasket.getPaymentInstruments();
            collections.forEach(paymentInstruments, function (paymentInstrument) {
                if (paymentInstrument.paymentMethod === 'DIGITAL_RIVER_DROPIN') {
                    currentBasket.removePaymentInstrument(paymentInstrument);
                }
            });
            var checkoutData = JSON.parse(currentBasket.custom.drCheckoutData);
            var primarySource = checkoutData.sources.find(function (source) {
                return source.type !== 'customerCredit';
            });
            var paymentInstrument = currentBasket.createPaymentInstrument(
                'DIGITAL_RIVER_DROPIN', new Money(primarySource.amount, currentBasket.currencyCode)
            );

            paymentInstrument.custom.drSourceId = primarySource.id;
            paymentInstrument.custom.drPaymentType = paymentInformation.paymentType;
            if (paymentInformation.paymentType === 'creditCard') {
                paymentInstrument.setCreditCardNumber(paymentInformation.cardNumber.value);
                paymentInstrument.setCreditCardType(paymentInformation.cardType.value);
                paymentInstrument.setCreditCardExpirationMonth(paymentInformation.expirationMonth.value);
                paymentInstrument.setCreditCardExpirationYear(paymentInformation.expirationYear.value);
                paymentInstrument.setCreditCardToken(paymentInformation.creditCardToken);
            }
        });
    } catch (e) {
        serverErrors.push(
            Resource.msg('error.payment.processor.not.supported', 'checkout', null)
        );
        return {
            fieldErrors: fieldErrors,
            serverErrors: serverErrors,
            error: true
        };
    }
    return {
        fieldErrors: fieldErrors,
        serverErrors: serverErrors,
        error: false
    };
}

/**
 *  Authorizes a payment using Digital River. The payment is authorized by using the Digital River processor
 * @param {string} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument - The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor - The payment processor of the current payment method
 * @return {Object} - returns an error object
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var serverErrors = [];
    var fieldErrors = {};
    var error = false;

    try {
        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
        });
    } catch (e) {
        error = true;
        serverErrors.push(
            Resource.msg('error.technical', 'checkout', null)
        );
    }

    return {
        fieldErrors: fieldErrors,
        serverErrors: serverErrors,
        error: error
    };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
