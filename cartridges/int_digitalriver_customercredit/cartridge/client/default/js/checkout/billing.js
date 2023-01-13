'use strict';

var billing = require('dr_sfra/checkout/billing');
var output = Object.assign({}, billing);

output.methods.updatePaymentInformation = function (order) {
    // update payment details
    var $paymentSummary = $('.payment-details');
    var htmlToAppend = '';
    var htmlGiftToAppend = '';

    if (order.billing.payment && order.billing.payment.selectedPaymentInstruments
        && order.billing.payment.selectedPaymentInstruments.length > 0) {
        var paymentInstruments = order.billing.payment.selectedPaymentInstruments;
        var index = 1;
        /*
            @IG:
            Modify labelCustomerCredit value with the value you want to be displayed on the UI
        */
        var labelCustomerCredit = $('#dr-list-of-applied-customercredits').data('payment-info-text');
        for (var i = 0; i < paymentInstruments.length; i++) {
            /*
                @IG:
                Modify the following condition depending on your implementation of secondary payment
            */
            if (paymentInstruments[i].paymentMethod === 'GIFT_CERTIFICATE' && paymentInstruments[i].giftCertificateCode === 'customer_credit_code') {
                htmlGiftToAppend += '<div class="col-6 start-lines">'
                    + '<span class="order-receipt-label">' + labelCustomerCredit + ' ' + index + '</span>'
                    + '</div><div class="col-6 end-lines">'
                    + '<div class="text-right">'
                    + '<span>' + paymentInstruments[i].formattedAmount + '</span></div></div>';
                index++;
            } else if (paymentInstruments[i].paymentType === 'creditCard') {
                htmlToAppend += '<div class="row leading-lines">'
                    + '<div class="col-6 start-lines">'
                    + '<span>' + order.resources.cardType + ' ' + paymentInstruments[i].type + '</span></div>'
                    + '<div class="col-6 end-lines"><div class="text-right">'
                    + '<span>' + paymentInstruments[i].formattedAmount + '</span></div></div></div>'
                    + '<div>' + paymentInstruments[i].maskedCreditCardNumber + '</div>'
                    + '<div><span>'
                    + order.resources.cardEnding + ' '
                    + paymentInstruments[i].expirationMonth
                    + '/' + paymentInstruments[i].expirationYear
                    + '</span></div>';
            } else if (order.billing.payment.selectedPaymentInstruments[0].paymentMethod !== 'DIGITAL_RIVER_ZERO_PAYMENT') {
                htmlToAppend += '<div class="row leading-lines">'
                + '<div class="col-6 start-lines">'
                + '<span>' + paymentInstruments[i].paymentType + '</span></div>'
                + '<div class="col-6 end-lines"><div class="text-right">'
                + '<span>' + paymentInstruments[i].formattedAmount + '</span></div></div></div>';
            }
        }
        if (htmlGiftToAppend) {
            htmlGiftToAppend = '<div class="row leading-lines">' + htmlGiftToAppend + '</div>';
        }
    }

    $paymentSummary.empty().append(htmlGiftToAppend + htmlToAppend);
};

module.exports = output;
