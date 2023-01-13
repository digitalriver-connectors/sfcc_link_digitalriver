'use strict';

/**
 * Account base controller overridden to prepend new middleware to all the existing routes
 * Middleware checks if ecommerce functionality is enabled for site then call next function in middleware chain otherwise redirect user to homepage
 *
 */

var page = module.superModule;
var server = require('server');

server.extend(page);

var Transaction = require('dw/system/Transaction');
var Site = require('dw/system/Site');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

server.append('SubmitRegistration', function (req, res, next) {
    this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
        var viewData = res.getViewData();
        var newCustomer = viewData.authenticatedCustomer;
        var dropInIsEnabled = Site.getCurrent().getCustomPreferenceValue('drUseDropInFeature');

        if (newCustomer && dropInIsEnabled) {
            var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
            var Resource = require('dw/web/Resource');
            var CustomerMgr = require('dw/customer/CustomerMgr');

            var profile = newCustomer.profile;
            var drResponse = drCustomerAPI.createCustomer(profile.email, profile.customerNo);
            if (!drResponse.ok) {
                CustomerMgr.removeCustomer(newCustomer);
                res.json({
                    success: false,
                    redirectUrl: null,
                    error: [Resource.msg('error.message.unable.to.register.account', 'digitalriver', null)]
                });
            } else {
                Transaction.wrap(function () {
                    profile.custom.globalCommerceCustID = drResponse.object.id;
                });
            }
        }
    });
    next();
});

server.append('Login', function (req, res, next) {
    var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
    var dropinHelper = require('*/cartridge/scripts/digitalRiver/dropinHelper');

    var viewData = res.getViewData();
    var loggedInCustomer = viewData.authenticatedCustomer;
    var dropInIsEnabled = Site.getCurrent().getCustomPreferenceValue('drUseDropInFeature');

    if (!loggedInCustomer || !dropInIsEnabled) {
        return next();
    }

    var drCustomerId = loggedInCustomer.profile.custom.globalCommerceCustID;
    var drResponse;
    if (!empty(drCustomerId)) { // synchronize customer's attached sources on DR side with customer's wallet
        drResponse = drCustomerAPI.getCustomerById(drCustomerId);
        if (drResponse) {
            var customerSources = drResponse.sources || [];
            var paymentInstruments = loggedInCustomer.profile.wallet.paymentInstruments.toArray();
            customerSources.forEach(function (source) {
                var alreadyInWallet = paymentInstruments.some(function (paymentInstrument) {
                    return paymentInstrument.custom.digitalRiverId === source.id;
                });
                if (!alreadyInWallet) {
                    dropinHelper.saveDropInPaymentToWallet(source, loggedInCustomer);
                }
            });
        }
    }
    return next();
});

server.append(
    'Show',
    server.middleware.https,
    userLoggedIn.validateLoggedIn,
    consentTracking.consent,
    function (req, res, next) {
        var Locale = require('dw/util/Locale');
        var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
        var drUtilsHelper = require('*/cartridge/scripts/digitalRiver/drUtilsHelper');
        var drCustomerId = req.currentCustomer.raw.profile.custom.globalCommerceCustID;
        var currentLocale = Locale.getLocale(req.locale.id);
        var viewData = res.getViewData();
        viewData.localeCountry = currentLocale && currentLocale.country;

        if (!empty(drCustomerId)) {
            var drResponse = drCustomerAPI.getCustomerById(drCustomerId);
            if (drResponse && drResponse.taxCertificates) {
                viewData.drTaxCertificates = {
                    companyName: drResponse.taxCertificates[0].companyName,
                    taxAuthority: drResponse.taxCertificates[0].taxAuthority,
                    startDate: drUtilsHelper.drDateToLocal(drResponse.taxCertificates[0].startDate),
                    endDate: drUtilsHelper.drDateToLocal(drResponse.taxCertificates[0].endDate)
                };
            }
        }

        res.setViewData(viewData);
        return next();
    }
);

module.exports = server.exports();
