'use strict';

var parent = module.superModule;
var collections = require('*/cartridge/scripts/util/collections');

/**
 * Extends payment instruments with detailed data to be shown during checkout
 * @param {Array} paymentInstruments payment instruments already collected by parent model
 * @param {Array} sourceInstruments payment instruments from current basket
 * @param {string} currencyCode currency code
 */
function extendDigitalRiverInfo(paymentInstruments, sourceInstruments, currencyCode) {
    var Money = require('dw/value/Money');
    paymentInstruments.forEach(function (paymentInstrument) {
        var creditMoneyAmount = null;
        if (paymentInstrument.paymentMethod === 'DIGITAL_RIVER_DROPIN') {
            creditMoneyAmount = new Money(paymentInstrument.amount, currencyCode);
            paymentInstrument.formattedAmount = creditMoneyAmount.toFormattedString(); // eslint-disable-line no-param-reassign
            /*
                @IG:
                Modify the following condition depending on your implementation of secondary payment
            */
        } else if (paymentInstrument.paymentMethod === 'GIFT_CERTIFICATE' && paymentInstrument.giftCertificateCode === 'customer_credit_code') {
            creditMoneyAmount = new Money(paymentInstrument.amount, currencyCode);
            paymentInstrument.formattedAmount = creditMoneyAmount.toFormattedString(); // eslint-disable-line no-param-reassign
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
        extendDigitalRiverInfo(this.selectedPaymentInstruments, currentBasket.paymentInstruments, currentBasket.currencyCode);
    }
    this.customerCreditUsed = !!collections.find(currentBasket.paymentInstruments, function (paymentInstrument) {
        return paymentInstrument.custom.drPaymentType === 'customerCredit';
    });
}

module.exports = Payment;
