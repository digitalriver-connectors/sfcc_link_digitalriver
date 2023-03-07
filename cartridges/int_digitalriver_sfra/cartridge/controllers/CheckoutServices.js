'use strict';

var server = require('server');
server.extend(module.superModule);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

server.append(
    'SubmitPayment',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
            var viewData = res.getViewData();
            if (!viewData.error) {
                var Resource = require('dw/web/Resource');
                var BasketMgr = require('dw/order/BasketMgr');
                var taxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');

                var digitalRiverEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('drUseDropInFeature');
                var currentBasket = BasketMgr.getCurrentBasket();
                var checkoutData = currentBasket ? taxHelper.parseCheckoutData(currentBasket.custom.drCheckoutData) : null;

                if (digitalRiverEnabled) {
                    if (!taxHelper.checkoutDataIsValid(checkoutData, currentBasket)) {
                        viewData.error = true;
                        viewData.fieldErrors = [];
                        viewData.serverErrors = [Resource.msg('error.checkout.invalidate', 'digitalriver', null)];
                    }
                }
            }
            res.setViewData(viewData);
        });
        return next();
    }
);


server.append(
    'PlaceOrder',
    function (req, res, next) {
        var viewData = res.getViewData();
        var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
        if (!req.custom) {
            return next();
        }

        if(!viewData.error || !req.custom)
        {
            return next();
        }

        if (!req.custom.isDrConflictError) { // eslint-disable-line no-undef
            return next();
        }
        
        checkoutHelper.resetBasketOnError(req, res);


        return next();
    }
);


module.exports = server.exports();
