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

/**
 *  @function
 * DigitalRiver-DRPlaceOrder
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next call in the middleware chain
* Route to handle DR order submission and redirect prior to placing Salesforce order (CheckoutServices-PlaceOrder)
*/
server.prepend(
    'PlaceOrder',
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Transaction = require('dw/system/Transaction');
        var URLUtils = require('dw/web/URLUtils');
        var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');

        var viewData = res.getViewData();
        var currentBasket = BasketMgr.getCurrentBasket();
        var checkoutId = currentBasket.custom.drCheckoutID;
        var Resource = require('dw/web/Resource');

        // Start additional validations prior to order placement

        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
        var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');

        if (!currentBasket) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }

        //Check for DR order Id and successful redirect.  If so skip DR Order placement.
        var drOrderId = Object.hasOwnProperty.call(currentBasket.custom, 'drOrderID') ? currentBasket.custom.drOrderID : null;
        if (drOrderId != null) {
            var drRedirectStatus = Object.hasOwnProperty.call(currentBasket.custom, 'drRedirectStatus') ? currentBasket.custom.drRedirectStatus : null;
            if (drRedirectStatus != null) {
                if (drRedirectStatus === 'redirect_success') {
                    return next();
                }
            }
        }

        // update basket to clear DR redirect status
        Transaction.wrap(function () {
            currentBasket.custom.drRedirectStatus = ''; // eslint-disable-line no-param-reassign
        });

        // Calculate the basket
        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(currentBasket);
        });

        var validatedProducts = validationHelpers.validateProducts(currentBasket);
        if (validatedProducts.error) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }

        if (req.session.privacyCache.get('fraudDetectionStatus')) {
            res.json({
                error: true,
                cartError: true,
                redirectUrl: URLUtils.url('Error-ErrorCode', 'err', '01').toString(),
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            });

            return next();
        }

        var validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
        if (validationOrderStatus.error) {
            res.json({
                error: true,
                errorMessage: validationOrderStatus.message
            });
            return next();
        }

        // Check to make sure there is a shipping address
        if (currentBasket.defaultShipment.shippingAddress === null) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'shipping',
                    step: 'address'
                },
                errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
            });
            return next();
        }

        // Check to make sure billing address exists
        if (!currentBasket.billingAddress) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'payment',
                    step: 'billingAddress'
                },
                errorMessage: Resource.msg('error.no.billing.address', 'checkout', null)
            });
            return next();
        }

        // Calculate the basket
        /*Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(currentBasket);
        });*/

        // Re-validates existing payment instruments
        var validPayment = COHelpers.validatePayment(req, currentBasket);
        if (validPayment.error) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'payment',
                    step: 'paymentInstrument'
                },
                errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null)
            });
            return next();
        }

        // Re-calculate the payments.
        var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
        if (calculatedPaymentTransactionTotal.error) {
            res.json({
                error: true,
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            });
            return next();
        }

        // End additional validations prior to order placement

        var DRResult = drCheckoutAPI.createOrder(checkoutId);
        var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
        if (DRResult.ok) {
            // update checkout with DR order variables
            Transaction.wrap(function () {
                currentBasket.custom.drOrderID = DRResult.object.id; // eslint-disable-line no-param-reassign
                currentBasket.custom.drPaymentSessionId = DRResult.object.payment.session.id; // eslint-disable-line no-param-reassign
            });

            if (DRResult.object.payment.session.state === 'pending_redirect' && DRResult.object.payment.session.nextAction.data.redirectUrl.length > 0) {
                // handle the redirect
                var paymentRedirectUrl = DRResult.object.payment.session.nextAction.data.redirectUrl;

                if (!viewData.error) {
                    viewData.continueUrl = paymentRedirectUrl;
                    viewData.placeFinalOrder = false;
                }
                // update basket with DR redirect status
                Transaction.wrap(function () {
                    currentBasket.custom.drRedirectStatus = 'pending_redirect'; // eslint-disable-line no-param-reassign
                });
            } else {
                // happy path flow.  continue with Salesforce order placement
                viewData.continueUrl = URLUtils.url('CheckoutServices-PlaceOrder').toString();
                viewData.placeFinalOrder = true;

                // update basket with DR redirect status
                Transaction.wrap(function () {
                    currentBasket.custom.drRedirectStatus = 'none'; // eslint-disable-line no-param-reassign
                });
            }
            res.json({
                error: false,
                orderID: '',
                orderToken: '',
                continueUrl: viewData.continueUrl
            });
        } else {
            // Create a custom object to track the order cancellation request
            checkoutHelper.createCancellationRequestCO(currentBasket.UUID, checkoutId);

            viewData.error = true;
            viewData.fieldErrors = [];
            viewData.serverErrors = [Resource.msg('error.technical', 'checkout', null)];
            res.json({
                error: true,
                errorStage: {
                    stage: 'payment'
                },
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            });
            checkoutHelper.resetBasketOnError(req, res); // calling checkout on DR side

            // update basket with DR redirect status
            Transaction.wrap(function () {
                currentBasket.custom.drRedirectStatus = 'order_placement_error'; // eslint-disable-line no-param-reassign
            });
        }
        return next();
    });

server.append(
    'PlaceOrder',
    function (req, res, next) {
        var viewData = res.getViewData();
        var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
        var Resource = require('dw/web/Resource');
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentBasket();
        var checkoutId = currentBasket ? currentBasket.custom.drCheckoutID : null;

        /*
        if (!req.custom) {
            return next();
        }

        if (!viewData.error || !req.custom) {
            return next();
        }
        */
        if (req.custom && !req.custom.isDrConflictError) { // eslint-disable-line no-undef
            return next();
        }

        if (viewData.error) {
            if (viewData.errorMessage === 'pending_redirect') {
                viewData.error = false;
                viewData.errorMessage = '';
            } else if (viewData.errorMessage === 'order_placement_error') {
                viewData.error = true;
                viewData.fieldErrors = [];
                viewData.serverErrors = [Resource.msg('error.technical', 'checkout', null)];
                res.json({
                    error: true,
                    errorStage: {
                        stage: 'payment'
                    },
                    errorMessage: Resource.msg('error.technical', 'checkout', null)
                });
            } else {
                // Create a custom object to track the order cancellation request
                checkoutHelper.createCancellationRequestCO(currentBasket.UUID, checkoutId);

                checkoutHelper.resetBasketOnError(req, res);
            }
        }

        return next();
    }
);

module.exports = server.exports();
