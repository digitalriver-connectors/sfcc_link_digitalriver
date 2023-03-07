'use strict';

var server = require('server');
server.extend(module.superModule);

/**
 * Handle Ajax shipping form submit
 */
server.append(
    'SubmitShipping',
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var URLUtils = require('dw/web/URLUtils');
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');

        var currentBasket = BasketMgr.getCurrentBasket();
        var viewData = res.getViewData();
        var billingForm = server.forms.getForm('billing');

        if (!req.currentCustomer.profile) {
            var contactInfoFormErrors = COHelpers.validateFields(billingForm.contactInfoFields); // if customer is not registered contactInfo fields should be filled in

            if (Object.keys(contactInfoFormErrors).length > 0) {
                viewData.error = true;
                viewData.fieldErrors = viewData.fieldErrors || [];
                viewData.fieldErrors.push(contactInfoFormErrors);
            }
        }

        if (viewData.error) {
            this.removeListener('route:BeforeComplete'); // as far as form is not valid, submit must be cancelled.
            res.json(viewData);
            return next();
        }

        this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
            var AccountModel = require('*/cartridge/models/account');
            var OrderModel = require('*/cartridge/models/order');
            var Locale = require('dw/util/Locale');
            var Resource = require('dw/web/Resource');
            var reqRedirectUrl = 'https://' + req.host; // adding code to get the hostname
            // if enabled drop-in, update view data with email address
            var currentSite = require('dw/system/Site').getCurrent();
            var digitalRiverUseDropInFeature = currentSite.getCustomPreferenceValue('drUseDropInFeature');
            if (!digitalRiverUseDropInFeature) {
                return;
            }

            COHelpers.copyShippingAddressToShipment(viewData, currentBasket.defaultShipment);

            var drCheckout = drCheckoutAPI.createCheckout(currentBasket, currentBasket.custom.drTaxIdentifierType);
            if (!drCheckout.ok) {
                res.json({
                    error: true,
                    fieldErrors: [],
                    serverErrors: [Resource.msg('error.technical', 'checkout', null)],
                    redirectUrl: URLUtils.url('Cart-Show').toString()
                });
                return;
            }

            var taxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');

            taxHelper.saveCheckoutDataToBasket(drCheckout.object, currentBasket, true);

            var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');

            COHelpers.recalculateBasket(currentBasket);

            var currentLocale = Locale.getLocale(req.locale.id);
            var basketModel = new OrderModel(
                currentBasket,
                {
                    usingMultiShipping: usingMultiShipping,
                    shippable: true,
                    countryCode: currentLocale.country,
                    containerView: 'basket'
                }
            );

            var dropinHelper = require('*/cartridge/scripts/digitalRiver/dropinHelper');

            var useDropIn = currentSite.getCustomPreferenceValue('drUseDropInFeature');
            var digitalRiverConfiguration = {
                currentLocaleId: req.locale.id.replace('_', '-'),
                APIKey: currentSite.getCustomPreferenceValue('drPublicKey'),
                dropInConfiguration: useDropIn
                    ? dropinHelper.getConfiguration({
                        basket: currentBasket,
                        customer: req.currentCustomer.raw,
                        reqUrl: reqRedirectUrl  // adding host name
                    })
                    : null,
                cancelRedirectUrl: URLUtils.url('Checkout-Begin', 'stage', 'payment').toString(),
                paymentErrorMessage: Resource.msg('error.checkout.paynowerror', 'digitalriver', null)
            };

            var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
            var siteLocaleInArray = req.locale.id.split('_');
            var digitalRiverComplianceOptions = {
                classes: {
                    base: 'DRElement'
                },
                compliance: {
                    country: siteLocaleInArray[1] || '', // 'de' or empty string
                    language: siteLocaleInArray[0],
                    businessEntityCode: drTaxHelper.getComplianceEntity()
                }
            };

            var taxIdentifierHelper = require('*/cartridge/scripts/digitalRiver/taxIdentifierHelper');

            // delete created tax identifiers
            var appliedTaxIdentifiers = taxIdentifierHelper.getAppliedTaxIdentifiers(currentBasket);
            if (appliedTaxIdentifiers && appliedTaxIdentifiers.length > 0) {
                taxIdentifierHelper.deleteAllIdentifiers(appliedTaxIdentifiers);
            }

            var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
            var drCountry = checkoutHelper.getCountry(currentBasket);
            var useTaxIdentifier = drCountry && drCountry.toUpperCase() !== 'US';
            var taxIdConfig = {
                currentLocaleId: req.locale.id.replace('_', '-'),
                APIKey: currentSite.getCustomPreferenceValue('drPublicKey'),
                country: drCountry && drCountry.toUpperCase(),
                useTaxIdentifier: useTaxIdentifier,
                sessionId: currentBasket ? currentBasket.custom.drPaymentSessionId : '',
                msgNotApplicable: Resource.msg('taxidentifier.notapplicable', 'digitalriver', null),
                deleteText: Resource.msg('button.delete', 'digitalriver', null),
                type: currentBasket.custom.drTaxIdentifierType
            };

            res.json({
                customer: new AccountModel(req.currentCustomer),
                order: basketModel,
                form: server.forms.getForm('shipping'),
                locale: 'en-US',
                digitalRiverTaxExemptData: drTaxHelper.getTaxExemptData(req.currentCustomer.raw, currentBasket),
                digitalRiverConfiguration: digitalRiverConfiguration,
                digitalRiverComplianceOptions: digitalRiverComplianceOptions,
                digitalRiverTaxIdConfig: taxIdConfig
            });
        });


        return next();
    }
);

module.exports = server.exports();
