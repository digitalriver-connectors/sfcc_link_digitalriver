'use strict';

var parent = module.superModule;
var output = {};
Object.keys(parent).forEach(function (key) {
    output[key] = parent[key];
});

/**
 * @description get basket price total subtracted gift certificate amount
 * @param {dw.order.Basket} basket - baslet
 * @returns {Object} - formated basket price total
 */

/*
    @IG:
    Modify the following function depending on your implementation of secondary payment
*/
output.getNonGiftCertificatePriceTotal = function (basket) {
    var Money = require('dw/value/Money');
    var currencyCode = basket.getCurrencyCode();
    var customerCreditTotal = new Money(0, currencyCode);
    var totalTaxDiscount = parent.getTaxDiscount(basket);
    var totalTaxAdjustmentMoney = new Money((totalTaxDiscount || 0), currencyCode);
    var totalPrice = basket.totalGrossPrice.add(totalTaxAdjustmentMoney);
    var paymentInstruments = basket.getGiftCertificatePaymentInstruments();

    if (paymentInstruments && paymentInstruments.length > 0) {
        customerCreditTotal = paymentInstruments.toArray().reduce(function (total, paymentInstrument) {
            return (paymentInstrument.giftCertificateCode === 'customer_credit_code')
                ? total.add(paymentInstrument.paymentTransaction.amount)
                : total;
        }, customerCreditTotal);
        totalPrice = totalPrice.subtract(customerCreditTotal);
    }

    return {
        value: totalPrice.value,
        formatted: totalPrice.toFormattedString(),
        customerCreditTotal: {
            value: customerCreditTotal.value,
            formatted: customerCreditTotal.toFormattedString()
        }
    };
};

/**
 * Resets all basket custom values related to specific Digital River Checkout
 * @param {dw.order.Basket} basket current basket
 */

/*
    @IG:
    Modify the following function depending on your implementation of secondary payment
*/
output.resetBasketCheckoutData = function (basket) {
    parent.resetBasketCheckoutData(basket);

    var Transaction = require('dw/system/Transaction');
    Transaction.wrap(function () {
        // Remove customer credit from the basket
        var paymentInstruments = basket.getGiftCertificatePaymentInstruments();
        if (paymentInstruments && paymentInstruments.length > 0) {
            paymentInstruments.toArray().forEach(function (paymentInstrument) {
                if (paymentInstrument.giftCertificateCode === 'customer_credit_code') {
                    basket.removePaymentInstrument(paymentInstrument);
                }
            });
        }
    });
};

module.exports = output;
