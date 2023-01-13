'use strict';

var server = require('server');

var parent = module.superModule;
server.extend(parent);
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

server.post(
    'DrSavePayment',
    csrfProtection.validateAjaxRequest,
    userLoggedIn.validateLoggedInAjax,
    function (req, res, next) {
        var data = res.getViewData();
        if (data && !data.loggedin) {
            res.json();
            return next();
        }

        var accountHelpers = require('*/cartridge/scripts/helpers/accountHelpers');
        var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
        var dropinHelper = require('*/cartridge/scripts/digitalRiver/dropinHelper');

        var input = req.form;
        var source = JSON.parse(input.source);

        this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
            var URLUtils = require('dw/web/URLUtils');

            var customer = req.currentCustomer.raw;

            // Attaching payment source to customer on Digital River
            var drSourceSaved = drCustomerAPI.savePaymentToCustomer(customer.profile.custom.globalCommerceCustID, source.id);
            if (!drSourceSaved.ok) {
                res.setStatusCode(400);
                res.json({
                    error: drSourceSaved.errorMessage
                });
                return;
            }

            dropinHelper.saveDropInPaymentToWallet(source, customer);

            // Send account edited email
            accountHelpers.sendAccountEditedEmail(customer.profile);

            res.json({
                success: true,
                redirectUrl: URLUtils.url('PaymentInstruments-List').toString()
            });
        });
        return next();
    }
);

// Providing billing form data to addPayment template to let user fill data necessary for Digital River drop-in
server.append(
    'AddPayment',
    function (req, res, next) {
        var currentSite = require('dw/system/Site').getCurrent();
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var customerHelper = require('*/cartridge/scripts/digitalRiver/drCustomerHelper');
        var dropInIsEnabled = currentSite.getCustomPreferenceValue('drUseDropInFeature');

        if (dropInIsEnabled) {
            var customerResult = customerHelper.checkDrCustomer(req.currentCustomer.raw.profile);

            if (customerResult.drCustomerError) {
                res.setViewData({ drCustomerError: customerResult.drCustomerError });
                return next();
            }
        }

        var customerForm = COHelpers.prepareCustomerForm('coCustomer');
        var billingForm = COHelpers.prepareBillingForm();

        var preferredAddress = req.currentCustomer.addressBook.preferredAddress;
        if (preferredAddress) {
            billingForm.copyFrom(preferredAddress);
            billingForm.addressFields.country.value = preferredAddress.countryCode.value;
            if (billingForm.addressFields.country.value === 'US') {
                billingForm.addressFields.states.stateCode.value = preferredAddress.stateCode;
            }
        }

        res.setViewData({
            forms: {
                customerForm: customerForm,
                billingForm: billingForm
            }
        });
        return next();
    }
);

server.append('DeletePayment', function (req, res, next) {
    var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
    var dropInIsEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('drUseDropInFeature');

    var payment = res.getViewData();
    var sourceId = payment.raw ? payment.raw.custom.digitalRiverId : null;
    if (sourceId && dropInIsEnabled) {
        var customerId = req.currentCustomer.raw.profile.custom.globalCommerceCustID;
        var drSourceDeleted = drCustomerAPI.deletePaymentForCustomer(customerId, sourceId);
        if (!drSourceDeleted.ok) {
            this.removeListener('route:BeforeComplete'); // If unable to delete source from DR, neither it's deleted from customer account
            res.setStatusCode(400);
            res.json({
                error: drSourceDeleted.errorMessage
            });
        }
    }
    next();
});

server.append('List', function (req, res, next) {
    var currentSite = require('dw/system/Site').getCurrent();
    var customerHelper = require('*/cartridge/scripts/digitalRiver/drCustomerHelper');
    var dropInIsEnabled = currentSite.getCustomPreferenceValue('drUseDropInFeature');

    if (dropInIsEnabled) {
        var customerResult = customerHelper.checkDrCustomer(req.currentCustomer.raw.profile);

        if (customerResult.drCustomerError) {
            res.setViewData({ drCustomerError: customerResult.drCustomerError });
            return next();
        }
    }

    return next();
});

module.exports = server.exports();
