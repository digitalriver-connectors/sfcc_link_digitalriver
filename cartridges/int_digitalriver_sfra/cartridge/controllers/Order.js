'use strict';

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

var server = require('server');
server.extend(module.superModule);

server.append('CreateAccount', function (req, res, next) {
    this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
        var dropInIsEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('drUseDropInFeature');
        var viewData = res.getViewData();
        var accountCreated = viewData.success;
        if (accountCreated && dropInIsEnabled) {
            var CustomerMgr = require('dw/customer/CustomerMgr');
            var Transaction = require('dw/system/Transaction');
            var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
            var Resource = require('dw/web/Resource');

            var customer = req.session.raw.getCustomer(); // req.currentCustomer hasn't been updated by this moment but raw session already contains authenticated customer
            var profile = customer.profile;
            var drResponse = drCustomerAPI.createCustomer(profile.email, profile.customerNo);
            if (!drResponse.ok) {
                CustomerMgr.removeCustomer(customer);
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

server.append(
    'Confirm',
    consentTracking.consent,
    server.middleware.https,
    csrfProtection.generateToken,
    function (req, res, next) {
        var Resource = require('dw/web/Resource');
        var viewData = res.getViewData();
        if (Object.hasOwnProperty.call(viewData, 'order')) {
            var OrderMgr = require('dw/order/OrderMgr');
            var taxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
            var drCustomerService = require('*/cartridge/scripts/services/digitalRiverCustomer');

            var order = OrderMgr.getOrder(req.form.orderID, req.form.orderToken);
            var checkoutData = taxHelper.parseCheckoutData(order.custom.drCheckoutData);
            var primarySource = checkoutData.sources.find(function (source) {
                return source.type !== 'customerCredit';
            });

            if (primarySource) {
                var drPaymentOptions = drCustomerService.getSourceById(primarySource.id);
                viewData.sourceId = drPaymentOptions.sourceId;
                viewData.sourceClientSecret = drPaymentOptions.sourceClientSecret;
            }
            viewData.complianceId = 'checkoutCompliance';
            viewData.complianceEntity = checkoutData.sellingEntity.id;
            viewData.vatReflectMsg = Resource.msg('msg.vat.reflect', 'digitalriver', null);

            res.setViewData(viewData);
        }

        return next();
    }
);

module.exports = server.exports();
