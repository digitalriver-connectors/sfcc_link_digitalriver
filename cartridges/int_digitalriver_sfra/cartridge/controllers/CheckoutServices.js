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

        if (!viewData.error || !request.custom.isDrConflictError) { // eslint-disable-line no-undef
            return next();
        }

        var URLUtils = require('dw/web/URLUtils');
        var Resource = require('dw/web/Resource');
        var currentSite = require('dw/system/Site').getCurrent();
        var currentBasket = require('dw/order/BasketMgr').getCurrentBasket();
        var taxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
        var dropinHelper = require('*/cartridge/scripts/digitalRiver/dropinHelper');
        var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');

        res.setViewData({
            errorStage: {
                stage: 'payment'
            }
        });

        if (currentBasket) {
            var drCheckout = drCheckoutAPI.createCheckout(currentBasket, currentBasket.custom.drTaxIdentifierType, true);

            if (drCheckout.ok) {
                taxHelper.saveCheckoutDataToBasket(drCheckout.object, currentBasket, true);

                var digitalRiverConfiguration = {
                    currentLocaleId: req.locale.id.replace('_', '-'),
                    APIKey: currentSite.getCustomPreferenceValue('drPublicKey'),
                    dropInConfiguration: dropinHelper.getConfiguration({
                        basket: currentBasket,
                        customer: req.currentCustomer.raw
                    }),
                    cancelRedirectUrl: URLUtils.url('Checkout-Begin', 'stage', 'payment').toString(),
                    paymentErrorMessage: Resource.msg('error.checkout.paynowerror', 'digitalriver', null)
                };

                res.setViewData({
                    digitalRiverConfiguration: digitalRiverConfiguration
                });
            }
        }

        return next();
    }
);

module.exports = server.exports();
