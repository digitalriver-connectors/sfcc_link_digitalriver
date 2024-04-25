'use strict';

var addressHelpers = require('base/checkout/address');

var base = require('base/checkout/shipping');

/**
* Updates the multi-ship information for the order and triggers an event
* @param {Object} order - the order object containing multi-shipping information
* @returns {void}
*/
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
        if (!$('.DR-place-order').data('dr-redirect-success')) {
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
                        $('body').trigger(
                            'checkout:updateCheckoutView',
                            {
                                order: data.order,
                                customer: data.customer,
                                options: { keepOpen: true }
                            }
                        );

                        $shippingMethodList.spinner().stop();
                    }
                }
            });
        }
    }, 300);
}

/**
* Updates the shipping list based on the provided event
*/
function updateShippingList() {
    var baseObj = this;
    var handler = function (e) {
        if (baseObj.methods && baseObj.methods.updateShippingMethodList) {
            baseObj.methods.updateShippingMethodList($(e.currentTarget.form));
        } else {
            updateShippingMethodList($(e.currentTarget.form));
        }
    };

    $(document).on('focusout', '.shippingZipCode', handler);

    $('select[name$="shippingAddress_addressFields_states_stateCode"]')
        .on('change', handler);
}

base.updateShippingList = updateShippingList;
base.methods.updateMultiShipInformation = updateMultiShipInformation;
base.methods.updateShippingMethodList = updateShippingMethodList;

module.exports = base;
