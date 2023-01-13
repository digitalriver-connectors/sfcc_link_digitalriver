'use strict';

var shippingHelpers = require('base/checkout/shipping');

var output = Object.assign({}, shippingHelpers);

output.methods.updateMultiShipInformation = function (order) {
    var $checkoutMain = $('#checkout-main');
    var $checkbox = $('[name=usingMultiShipping]');
    var $submitShippingBtn = $('button.submit-shipping');
    var $drCustomerError = $('.dr-customer-error');
    $('.shipping-error .alert-danger').remove();

    if (order.usingMultiShipping) {
        $checkoutMain.addClass('multi-ship');
        $checkbox.prop('checked', true);
    } else {
        $checkoutMain.removeClass('multi-ship');
        $checkbox.prop('checked', null);
        if (!$drCustomerError.length) {
            $submitShippingBtn.prop('disabled', null);
        }
    }

    $('body').trigger('shipping:updateMultiShipInformation', { order: order });
};

module.exports = output;
