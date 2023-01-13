'use strict';

var parent = module.superModule;

/**
 * Extends DIGITAL_RIVER_DROPIN payment instruments with detailed data to be shown during checkout
 * @param {Array} paymentInstruments payment instruments already collected by parent model
 * @param {Array} sourceInstruments payment instruments from current basket
 */
function extendDigitalRiverInfo(paymentInstruments, sourceInstruments) {
    paymentInstruments.forEach(function (paymentInstrument, index) {
        if (paymentInstrument.paymentMethod === 'DIGITAL_RIVER_DROPIN') {
            var source = sourceInstruments[index];
            // Extend model logic if you want to provide details for non-card payment methods
            paymentInstrument.paymentType = source.custom.drPaymentType; // eslint-disable-line no-param-reassign
            paymentInstrument.lastFour = source.creditCardNumberLastDigits; // eslint-disable-line no-param-reassign
            paymentInstrument.owner = source.creditCardHolder; // eslint-disable-line no-param-reassign
            paymentInstrument.expirationYear = source.creditCardExpirationYear; // eslint-disable-line no-param-reassign
            paymentInstrument.type = source.creditCardType; // eslint-disable-line no-param-reassign
            paymentInstrument.maskedCreditCardNumber = source.maskedCreditCardNumber; // eslint-disable-line no-param-reassign
            paymentInstrument.expirationMonth = source.creditCardExpirationMonth; // eslint-disable-line no-param-reassign
        }
    });
}
/**
 * Payment class that represents payment information for the current basket
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @param {dw.customer.Customer} currentCustomer - the associated Customer object
 * @param {string} countryCode - the associated Site countryCode
 * @constructor
 */
function Payment(currentBasket) {
    parent.apply(this, arguments);
    if (this.selectedPaymentInstruments && this.selectedPaymentInstruments.length > 0) {
        extendDigitalRiverInfo(this.selectedPaymentInstruments, currentBasket.paymentInstruments);
    }
}

module.exports = Payment;
