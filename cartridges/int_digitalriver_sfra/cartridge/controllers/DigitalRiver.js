/* globals request */
'use strict';

var server = require('server');
var OrderMgr = require('dw/order/OrderMgr');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

server.post('DRUpdateOrder', function (req) {
    var reqData = JSON.parse(req.body);
    var items = reqData.data.object.items;
    var orderId = reqData.data.object.orderId;
    var Transaction = require('dw/system/Transaction');

    var updatedOrder = OrderMgr.searchOrder(
        'custom.drOrderID={0}',
        orderId
    );
    for (var i = 0; i < items.length; i++) {
        var id = items[i].skuId;
        var products = updatedOrder.getAllProductLineItems(id);
        for (var j = 0; j < products.length; j++) {
            var quantity;
            if (products[j].productID === id) {
                var prodQuantity = products[j].quantityValue;
                if (reqData.type === 'fulfillment.created') {
                    quantity = items[i].quantity;
                    var cancelQuantity = items[i].cancelQuantity;
                    Transaction.wrap(function () { // eslint-disable-line no-loop-func
                        if (prodQuantity === quantity) {
                            products[j].setExternalLineItemStatus('Shipped');
                        } else if (prodQuantity === cancelQuantity) {
                            products[j].setExternalLineItemStatus('Cancelled');
                        } else {
                            products[j].setExternalLineItemStatus('partially shipped');
                        }
                    });
                } else if (reqData.type === 'return.created') {
                    quantity = items[i].quantity;
                    Transaction.wrap(function () { // eslint-disable-line no-loop-func
                        if (prodQuantity === quantity) {
                            products[j].setExternalLineItemStatus('Returned');
                        } else {
                            products[j].setExternalLineItemStatus('partially shipped');
                        }
                    });
                }
            }
        }
    }
});

server.post('SubmitPayment', function (req, res, next) {
    var Resource = require('dw/web/Resource');
    var BasketMgr = require('dw/order/BasketMgr');
    var Transaction = require('dw/system/Transaction');

    var currentBasket = BasketMgr.getCurrentBasket();
    var dropinHelper = require('*/cartridge/scripts/digitalRiver/dropinHelper');
    var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');

    var reqData = req.form;
    var reqDataObject = JSON.parse(reqData.drData);
    var submitPaymentResponse = {
        error: false
    };

    if (reqDataObject.sessionId === currentBasket.custom.drPaymentSessionId) { // security check
        Transaction.wrap(function () { // eslint-disable-line no-loop-func
            currentBasket.custom.drDropInResponse = reqData.drData;
        });
        var dropInSummary = dropinHelper.getDropInSummary({
            basket: currentBasket
        });
        submitPaymentResponse.dropInSummary = dropInSummary;
        submitPaymentResponse.complianceEntity = drTaxHelper.getComplianceEntity(currentBasket);
    } else {
        submitPaymentResponse = {
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        };
    }

    res.json(submitPaymentResponse);
    next();
});

server.get('TaxIdentifierConfig', function (req, res, next) {
    var currentSite = require('dw/system/Site').getCurrent();
    var BasketMgr = require('dw/order/BasketMgr');
    var Locale = require('dw/util/Locale');
    var Resource = require('dw/web/Resource');
    var OrderModel = require('*/cartridge/models/order');
    var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
    var taxIdentifierHelper = require('*/cartridge/scripts/digitalRiver/taxIdentifierHelper');
    var currentBasket = BasketMgr.getCurrentBasket();
    var currentLocale = Locale.getLocale(req.locale.id);

    // delete created tax identifiers
    var appliedTaxIdentifiers = taxIdentifierHelper.getAppliedTaxIdentifiers(currentBasket);
    if (appliedTaxIdentifiers && appliedTaxIdentifiers.length > 0) {
        taxIdentifierHelper.deleteAllIdentifiers(appliedTaxIdentifiers);
    }

    // basket model
    var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
    var basketModel = new OrderModel(
            currentBasket,
            { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: 'basket' }
        );
    var drCountry = checkoutHelper.getCountry(currentBasket);
    var taxIdConfig = {
        order: basketModel,
        currentLocaleId: req.locale.id.replace('_', '-'),
        APIKey: currentSite.getCustomPreferenceValue('drPublicKey'),
        country: drCountry && drCountry.toUpperCase(),
        sessionId: currentBasket ? currentBasket.custom.drPaymentSessionId : '',
        msgNotApplicable: Resource.msg('taxidentifier.notapplicable', 'digitalriver', null),
        deleteText: Resource.msg('button.delete', 'digitalriver', null),
        type: currentBasket.custom.drTaxIdentifierType
    };

    res.json(taxIdConfig);
    next();
});

server.post('TaxIdentifierApply', function (req, res, next) {
    var Resource = require('dw/web/Resource');
    var BasketMgr = require('dw/order/BasketMgr');
    var Locale = require('dw/util/Locale');
    var currentBasket = BasketMgr.getCurrentBasket();
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var AccountModel = require('*/cartridge/models/account');
    var OrderModel = require('*/cartridge/models/order');
    var taxIdentifierHelper = require('*/cartridge/scripts/digitalRiver/taxIdentifierHelper');
    var ajaxResponse = {
        error: false,
        errorMessage: '',
        deleteText: Resource.msg('button.delete', 'digitalriver', null),
        customer: new AccountModel(req.currentCustomer)
    };
    var stringifiedIdentifiers = req.form && req.form.taxIdentifiers ? req.form.taxIdentifiers : '';
    var taxIdentifiers = JSON.parse(stringifiedIdentifiers);
    // if we have identifiers to apply
    if (!empty(taxIdentifiers) && Object.keys(taxIdentifiers).length !== 0) {
        // create identifiers on DR side and assign to checkout
        var helperResponse = taxIdentifierHelper.createTaxIdentifiers(taxIdentifiers);
        if (helperResponse.error) {
            ajaxResponse.errorMessage = Resource.msg('error.identifier.notapplied', 'digitalriver', null);
            ajaxResponse.error = true;
        } else {
            COHelpers.recalculateBasket(currentBasket);
        }
        ajaxResponse.appliedTaxIdentifiers = helperResponse.appliedTaxIdentifiers;

        // basket model
        var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
        var currentLocale = Locale.getLocale(req.locale.id);

        var basketModel = new OrderModel(
            currentBasket,
            { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: 'basket' }
        );
        ajaxResponse.order = basketModel;
    }

    res.json(ajaxResponse);
    next();
});

server.post('TaxIdentifierDelete', function (req, res, next) {
    var Resource = require('dw/web/Resource');
    var BasketMgr = require('dw/order/BasketMgr');
    var Locale = require('dw/util/Locale');
    var currentBasket = BasketMgr.getCurrentBasket();
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var AccountModel = require('*/cartridge/models/account');
    var OrderModel = require('*/cartridge/models/order');
    var taxIdentifierHelper = require('*/cartridge/scripts/digitalRiver/taxIdentifierHelper');
    var ajaxResponse = {
        error: false,
        errorMessage: '',
        notUsed: false,
        customer: new AccountModel(req.currentCustomer)
    };
    var identifierId = req.form && req.form.identifierId ? req.form.identifierId : '';
    if (empty(identifierId)) {
        ajaxResponse.notUsed = true;
    } else {
        var helperResponse = taxIdentifierHelper.deleteIdentifier(identifierId, false);
        if (helperResponse.error) {
            ajaxResponse.errorMessage = Resource.msg('error.technical', 'checkout', null);
            ajaxResponse.error = true;
        } else {
            COHelpers.recalculateBasket(currentBasket);
        }

        // basket model
        var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
        var currentLocale = Locale.getLocale(req.locale.id);

        var basketModel = new OrderModel(
            currentBasket,
            { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: 'basket' }
        );
        ajaxResponse.order = basketModel;
    }

    res.json(ajaxResponse);
    next();
});

server.get('DropInConfig', function (req, res, next) {
    var dropinHelper = require('*/cartridge/scripts/digitalRiver/dropinHelper');
    var currentSite = require('dw/system/Site').getCurrent();
    var BasketMgr = require('dw/order/BasketMgr');
    var URLUtils = require('dw/web/URLUtils');
    var reqRedirectUrl = 'https://' + req.host; // adding code to get the hostname

    var digitalRiverConfiguration = {
        currentLocaleId: req.locale.id.replace('_', '-'),
        APIKey: currentSite.getCustomPreferenceValue('drPublicKey'),
        dropInConfiguration: dropinHelper.getConfiguration({
            basket: BasketMgr.getCurrentBasket(),
            customer: req.currentCustomer.raw,
            reqUrl: reqRedirectUrl  // adding host name
        }),
        cancelRedirectUrl: URLUtils.url('Checkout-Begin', 'stage', 'payment').toString()
    };

    res.json(digitalRiverConfiguration);
    next();
});

server.post('LogMessage', function (req, res, next) {
    var message = request.httpParameterMap.message;
    var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.checkout');

    logger.warn('There was a problem processing customer "{0}" payment: {1}', req.currentCustomer.raw.ID, message);

    res.json({
        success: true
    });
    next();
});


server.get('DisplayCompliance', function (req, res, next) {
    res.render('/digitalriver/compliance', {
        complianceId: req.querystring.complianceId
    });
    next();
});

server.post('SubmitDropInConfigForm',
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var currentSite = require('dw/system/Site').getCurrent();
        var URLUtils = require('dw/web/URLUtils');
        var form = server.forms.getForm('billing');
        var customerForm = server.forms.getForm('coCustomer');
        var addressErrors = COHelpers.validateFields(form.addressFields);
        var contactErrors = COHelpers.validateFields(form.contactInfoFields);
        var errors = [];

        if (Object.keys(addressErrors).length > 0) {
            errors.push(addressErrors);
        }
        if (Object.keys(contactErrors).length > 0) {
            errors.push(contactErrors);
        }

        if (errors.length > 0) {
            res.json({
                error: true,
                fieldErrors: errors
            });
        } else {
            var billingAddress = {
                firstName: form.addressFields.firstName.value,
                lastName: form.addressFields.lastName.value,
                email: customerForm.email.value,
                phoneNumber: form.contactInfoFields.phone.value,
                address: {
                    line1: form.addressFields.address1.value,
                    line2: form.addressFields.address2.value,
                    country: form.addressFields.country.value,
                    state: form.addressFields.states.stateCode.value,
                    city: form.addressFields.city.value,
                    postalCode: form.addressFields.postalCode.value
                }
            };

            var configuration = {
                billingAddress: billingAddress
            };
            res.json({
                currentLocaleId: req.locale.id.replace('_', '-'),
                APIKey: currentSite.getCustomPreferenceValue('drPublicKey'),
                cancelRedirectUrl: URLUtils.url('Checkout-Begin', 'stage', 'payment').toString(),
                dropInConfiguration: configuration,
                complianceEntity: currentSite.getCustomPreferenceValue('drDefaultEntity')
            });
        }
        next();
    });

server.post('StoredCards', function (req, res, next) {
    var Resource = require('dw/web/Resource');
    var drCustomerService = require('*/cartridge/scripts/services/digitalRiverCustomer');
    var currentBasket = require('dw/order/BasketMgr').getCurrentBasket();

    var result = null;
    if (req.form.storedPaymentUUID && req.currentCustomer.raw.authenticated && req.currentCustomer.raw.registered) {
        var array = require('*/cartridge/scripts/util/array');
        var storedPaymentUUID = req.form.storedPaymentUUID;
        var paymentInstruments = req.currentCustomer.wallet.paymentInstruments;
        var paymentInstrument = array.find(paymentInstruments, function (item) {
            return storedPaymentUUID === item.UUID;
        });

        result = drCustomerService.getSourceById(paymentInstrument.raw.custom.digitalRiverId);

        if (result && currentBasket && currentBasket.custom.drPaymentSessionId) {
            result.sessionId = currentBasket.custom.drPaymentSessionId;
        }
    }

    res.json({
        cardDetails: result,
        errorMessage: Resource.msg('error.sca', 'digitalriver', null)
    });
    return next();
});

server.get('InvoiceCredit', server.middleware.include, function (req, res, next) {
    var drOrderAPI = require('*/cartridge/scripts/services/digitalRiverOrder');
    var orderCallResult = drOrderAPI.getOrder(req.querystring.id);
    var invoiceIds;
    var creditMemoIds;

    if (orderCallResult.ok) {
        var invoicePDFs = orderCallResult.object.invoicePDFs;
        var creditMemoPDFs = orderCallResult.object.creditMemoPDFs;

        if (invoicePDFs) {
            invoiceIds = invoicePDFs
            .map(function (invoice) {
                return invoice.id;
            })
            .join(',');
        }

        if (creditMemoPDFs) {
            creditMemoIds = creditMemoPDFs
            .map(function (creditMemo) {
                return creditMemo.id;
            })
            .join(',');
        }
    }

    res.render('digitalriver/orderInvoice', {
        invoiceIds: invoiceIds,
        creditMemoIds: creditMemoIds
    });

    return next();
});

server.get('FileLinks', function (req, res, next) {
    var drOrderAPI = require('*/cartridge/scripts/services/digitalRiverOrder');
    var FOUR_HOURS_FROM_NOW = Date.now() + 14400000;
    var fileIds = req.querystring.ids.split(',');
    var fileLinks = [];

    fileIds.forEach(function (fileId) {
        var body = {
            fileId: fileId,
            expiresTime: new Date(FOUR_HOURS_FROM_NOW).toISOString()
        };
        var callResult = drOrderAPI.createFileLink(body);

        if (callResult.ok) {
            fileLinks.push({
                id: callResult.object.id,
                url: callResult.object.url
            });
        }
    });

    res.json({ fileLinks: fileLinks });

    return next();
});

server.post('PurchaseType', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var OrderModel = require('*/cartridge/models/order');
    var Locale = require('dw/util/Locale');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var taxIdentifierHelper = require('*/cartridge/scripts/digitalRiver/taxIdentifierHelper');
    var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
    var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
    var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
    var currentBasket = BasketMgr.getCurrentBasket();
    var currentLocale = Locale.getLocale(req.locale.id);
    var checkoutId = currentBasket.custom.drCheckoutID;
    var purchaseType = req.form.purchaseType;
    var billingCountryChanged = req.form.billingCountryChanged;
    var isDigitalCart = checkoutHelper.checkDigitalProductsOnly(currentBasket.productLineItems);
    var billingForm = server.forms.getForm('billing');
    var billTo;

    var billingFormErrors = COHelpers.validateBillingForm(billingForm.addressFields);
    var stateCode;
    if(billingForm.addressFields && billingForm.addressFields.states)
    {
        stateCode = billingForm.addressFields.states.stateCode.value;
     }
    if (!Object.keys(billingFormErrors).length) {
        var billingAddress = {
            firstName: billingForm.addressFields.firstName.value,
            lastName: billingForm.addressFields.lastName.value,
            address1: billingForm.addressFields.address1.value,
            address2: billingForm.addressFields.address2.value,
            city: billingForm.addressFields.city.value,
            postalCode: billingForm.addressFields.postalCode.value,
            countryCode: billingForm.addressFields.country        
        };
        if(stateCode && stateCode != ''){
            billingAddress['stateCode'] = stateCode;
         }

        COHelpers.copyBillingAddressToBasket(billingAddress, currentBasket);

        var billing = currentBasket.billingAddress;
        if (billing) {
            billTo = {
                address: {
                    line1: billing.address1,
                    line2: billing.address2,
                    city: billing.city,
                    postalCode: billing.postalCode,
                    state: billing.stateCode,
                    country: billing.countryCode.value
                },
                name: billing.fullName,
                email: currentBasket.getCustomerEmail()
            };
        }
    }

    // delete created tax identifiers
    if (purchaseType || (isDigitalCart && billingCountryChanged)) {
        var appliedTaxIdentifiers = taxIdentifierHelper.getAppliedTaxIdentifiers(currentBasket);
        if (appliedTaxIdentifiers && appliedTaxIdentifiers.length > 0) {
            taxIdentifierHelper.deleteAllIdentifiers(appliedTaxIdentifiers);
        }
    }

    var checkoutUpdateBody = {};
    if (purchaseType) {
        checkoutUpdateBody.customerType = purchaseType;
    }
    if (billTo) {
        checkoutUpdateBody.billTo = billTo;
    }

    var checkoutResult = drCheckoutAPI.updateCheckout(checkoutId, checkoutUpdateBody);
    if (!checkoutResult.ok) {
        res.json({
            error: true
        });
        return next();
    }

    drTaxHelper.saveCheckoutDataToBasket(checkoutResult.object, currentBasket);
    COHelpers.recalculateBasket(currentBasket);

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

    res.json({
        success: true,
        order: new OrderModel(currentBasket, { countryCode: currentLocale.country, containerView: 'basket' }),
        digitalRiverComplianceOptions: digitalRiverComplianceOptions
    });

    return next();
});

/**
 *  @function
 * DigitalRiver-DRPlaceOrder
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next call in the middleware chain
* Route to handle DR order submission and redirect prior to placing Salesforce order (CheckoutServices-PlaceOrder)
*/
server.post('DRPlaceOrder', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Transaction = require('dw/system/Transaction');
    var URLUtils = require('dw/web/URLUtils');
    var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
    
    var viewData = res.getViewData();
    var currentBasket = BasketMgr.getCurrentBasket();
    var checkoutId = currentBasket.custom.drCheckoutID;
    var Resource = require('dw/web/Resource');

    var DRResult = drCheckoutAPI.createOrder(checkoutId);
    var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
    if (DRResult.ok) {
        //update checkout with DR order variables
        Transaction.wrap(function () {
            currentBasket.custom.drOrderID = DRResult.object.id; // eslint-disable-line no-param-reassign
            currentBasket.custom.drPaymentSessionId = DRResult.object.payment.session.id; // eslint-disable-line no-param-reassign   
        });

        if (DRResult.object.payment.session.state === 'pending_redirect'  && DRResult.object.payment.session.nextAction.data.redirectUrl.length > 0) {
            //handle the redirect
            var paymentRedirectUrl = DRResult.object.payment.session.nextAction.data.redirectUrl;

            if (!viewData.error) {
                viewData.continueUrl = paymentRedirectUrl;
                viewData.placeFinalOrder = false;
            }
        }
        else {
            //happy path flow.  continue with Salesforce order placement
            viewData.continueUrl = URLUtils.url('CheckoutServices-PlaceOrder').toString();
            viewData.placeFinalOrder = true;
        }
        res.json({
            error: false,
            orderID: '',
            orderToken: '',
            continueUrl: viewData.continueUrl
        });
    
    }
    else {
        viewData.error = true;
        viewData.fieldErrors = [];
        viewData.serverErrors = [Resource.msg('error.technical', 'checkout', null)];
        res.json({
            error:true,
            errorStage: {
            stage: 'payment'  
             },
           errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        checkoutHelper.resetBasketOnError(req, res); // calling checkout on DR side
    }
    return next();
});

module.exports = server.exports();
