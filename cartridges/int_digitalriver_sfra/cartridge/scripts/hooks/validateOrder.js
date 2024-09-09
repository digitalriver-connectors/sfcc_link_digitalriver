'use strict';

var parent = module.superModule;
var output = {};
Object.keys(parent).forEach(function (key) {
    output[key] = parent[key];
});

output.validateOrder = function validateOrder(basket) {
    var result = parent.validateOrder.apply(null, arguments);
    if (!result.error) {
        var Resource = require('dw/web/Resource');
        var taxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
        var digitalRiverEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('drUseDropInFeature');
        var checkoutData = basket ? taxHelper.parseCheckoutData(basket.custom.drCheckoutData) : null;

        if (digitalRiverEnabled && !taxHelper.checkoutDataIsValid(checkoutData, basket)) {
            result.error = true;
            result.message = Resource.msg('error.checkout.invalidate', 'digitalriver', null);
        }

        if (digitalRiverEnabled) {
            var drRedirectStatus = Object.hasOwnProperty.call(basket.custom, 'drRedirectStatus') ? basket.custom.drRedirectStatus : null;
            if (drRedirectStatus != null) {
                if (drRedirectStatus === 'pending_redirect' || drRedirectStatus === 'redirect_failure' || drRedirectStatus === 'order_placement_error') {
                    result.error = true;
                    //To do evaluate replace error message
                    result.message = drRedirectStatus;
                }
            }
        }
    }
    return result;
};

module.exports = output;
