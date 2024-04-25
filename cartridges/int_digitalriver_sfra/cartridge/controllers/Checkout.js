'use strict';

var server = require('server');
server.extend(module.superModule);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

// Main entry point for Checkout

server.prepend(
    'Begin',
    server.middleware.https,
    csrfProtection.generateToken,
    function (req, res, next) {
        var Resource = require('dw/web/Resource');
        var BasketMgr = require('dw/order/BasketMgr');
        var currentSite = require('dw/system/Site').getCurrent();
        var drUtilsHelper = require('*/cartridge/scripts/digitalRiver/drUtilsHelper');
        var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
        var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
        var customerHelper = require('*/cartridge/scripts/digitalRiver/drCustomerHelper');
        var dropInIsEnabled = currentSite.getCustomPreferenceValue('drUseDropInFeature');
        var profile = req.currentCustomer.raw.profile;
        var drTaxCertificates = null;
        var drCustomer = null;
        var customerType = null;

        if (profile && dropInIsEnabled) {
            var customerResult = customerHelper.checkDrCustomer(profile);

            if (customerResult.drCustomerError) {
                res.setViewData({ drCustomerError: customerResult.drCustomerError });
            }

            if (customerResult.drCustomer) {
                drCustomer = customerResult.drCustomer;
                customerType = drCustomer.customerType;
                if (drCustomer.taxCertificates) {
                    drTaxCertificates = drCustomer.taxCertificates.map(function (certificate) {
                        return {
                            fileId: certificate.fileId,
                            companyName: certificate.companyName,
                            taxAuthority: certificate.taxAuthority,
                            startDate: drUtilsHelper.drDateToUS(certificate.startDate),
                            endDate: drUtilsHelper.drDateToUS(certificate.endDate)
                        };
                    });
                }
            }
        }

        var certificateForm = server.forms.getForm('taxCertificate');
        certificateForm.clear();

        var currentBasket = BasketMgr.getCurrentBasket();

        // Digital River - 2.6 - Redirect flow
        var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');

        var drPaymentSessionID = req.querystring.drPaymentSessionId;
        var drOrderID = currentBasket.custom.drOrderID;
        var isRedirectSuccess = false;
        var isRedirectFailure = false;

        if (drPaymentSessionID && (drPaymentSessionID === currentBasket.custom.drPaymentSessionId) && drOrderID.length > 0) {
            var drOrderRefreshResponse = drCheckoutAPI.refreshOrder(drOrderID);
            if (drOrderRefreshResponse.object.state === 'accepted' || drOrderRefreshResponse.object.state === 'in_review'
                || (drOrderRefreshResponse.object.state === 'pending_payment' && drOrderRefreshResponse.object.payment.session.state === 'pending')
                || (drOrderRefreshResponse.object.state === 'pending_payment' && drOrderRefreshResponse.object.payment.session.state === 'pending_funds')) {
                // handle success scenario, proceed with placing the order
                res.setViewData({
                    drRedirectError: false,
                    drRedirectSuccess: true
                });
                isRedirectSuccess = true;
            } else {
                // handle failure scenario
                res.setViewData({
                    errorMessage: Resource.msg('error.order.redirect.failure', 'digitalriver', null),
                    error: true,
                    drRedirectError: true,
                    drRedirectSuccess: false
                });
                isRedirectFailure = true;
                checkoutHelper.resetBasketOnError(req, res);
            }
        }
        // End Digital River - 2.6 - Redirect flow

        var currentStage = req.querystring.stage;
        if ((!currentStage || currentStage === 'shipping') && !isRedirectSuccess && !isRedirectFailure) {
            drTaxHelper.resetBasketCheckoutData(currentBasket);
        }

        var isDigitalCart = checkoutHelper.checkDigitalProductsOnly(currentBasket.productLineItems);
        var drCountry = checkoutHelper.getCountry(currentBasket);
        var useTaxIdentifier = drCountry && drCountry.toUpperCase() !== 'US';
        var viewData = {
            accountlanding: false,
            digitalRiverUseDropInFeature: dropInIsEnabled,
            digitalRiverCustomerType: customerType,
            digitalRiverTaxCertificate: drTaxCertificates,
            digitalRiverTaxExemptData: drTaxHelper.getTaxExemptData(req.currentCustomer.raw, currentBasket),
            isDigitalCart: isDigitalCart,
            certificateForm: certificateForm,
            digitalRiverUseTaxIdentifier: useTaxIdentifier
        };
        res.setViewData(viewData);

        return next();
    }
);

module.exports = server.exports();
