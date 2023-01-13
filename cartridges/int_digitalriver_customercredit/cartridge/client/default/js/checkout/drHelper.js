'use strict';

var drHelper = require('dr_sfra/checkout/drHelper');
var output = Object.assign({}, drHelper);

output.updateCustomerCreditTotal = function (adjustedGrandTotal, customerCreditSources) {
    if (adjustedGrandTotal && adjustedGrandTotal.customerCreditTotal.value > 0) {
        $('.customerCredit-block').removeClass('hide-order-discount');
        $('.customerCredit-total').empty().append(adjustedGrandTotal.customerCreditTotal.formatted);
        $('.grand-total-sum-adjusted').empty().append(adjustedGrandTotal.formatted);
    } else {
        $('.customerCredit-block').addClass('hide-order-discount');
    }
    if (customerCreditSources && customerCreditSources.length > 0) {
        var htmlGiftToAppend = '';
        /*
            @IG:
            Modify labelCustomerCredit value with the value you want to be displayed on the UI
        */
        var labelCustomerCredit = $('#dr-list-of-applied-customercredits').data('payment-info-text');
        for (var i = 0; i < customerCreditSources.length; i++) {
            htmlGiftToAppend += '<div class="col-6 start-lines">'
                + '<span class="order-receipt-label">' + labelCustomerCredit + ' ' + (i + 1) + '</span>'
                + '</div><div class="col-6 end-lines">'
                + '<div class="text-right">'
                + '<span>' + customerCreditSources[i].formatted + '</span></div></div>';
        }
        $('.payment-details').empty().append('<div class="row leading-lines">' + htmlGiftToAppend + '</div>');
    }
};

module.exports = output;
