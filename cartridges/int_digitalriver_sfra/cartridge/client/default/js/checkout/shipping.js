'use strict';
var addressHelpers = require('base/checkout/address');

var base = require('base/checkout/shipping');

function updateMultiShipInformation(order) {
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
}

/**
 * Digital River - 2.6 - Redirect flow - updated timeout, don't call for successful redirect
 * Update list of available shipping methods whenever user modifies shipping address details.
 * @param {jQuery} $shippingForm - current shipping form
 */
function updateShippingMethodList($shippingForm) {
    // delay for autocomplete!
    setTimeout(function () {
        var $shippingMethodList = $shippingForm.find('.shipping-method-list');
        var urlParams = addressHelpers.methods.getAddressFieldsFromUI($shippingForm);
        var shipmentUUID = $shippingForm.find('[name=shipmentUUID]').val();
        var url = $shippingMethodList.data('actionUrl');
        urlParams.shipmentUUID = shipmentUUID;
        if(!$('.DR-place-order').data('dr-redirect-success'))
        {
            $shippingMethodList.spinner().start();
            $.ajax({
                url: url,
                type: 'post',
                dataType: 'json',
                data: urlParams,
                success: function (data) {
                    if (data.error) {
                        window.location.href = data.redirectUrl;
                    } else {
                        $('body').trigger('checkout:updateCheckoutView',
                            {
                                order: data.order,
                                customer: data.customer,
                                options: { keepOpen: true }
                            });

                        $shippingMethodList.spinner().stop();
                    }
                }
            });
        }
    }, 300);
}


base.methods.updateMultiShipInformation = updateMultiShipInformation;
base.methods.updateShippingMethodList = updateShippingMethodList;

module.exports = base;
