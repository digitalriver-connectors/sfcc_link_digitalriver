'use strict';

/**
 * Verifies the required information for billing form is provided.
 *
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
    var viewData = viewFormData;
    var Resource = require('dw/web/Resource');
    var Transaction = require('dw/system/Transaction');
    var BasketMgr = require('dw/order/BasketMgr');
    var currentBasket = BasketMgr.getCurrentBasket();
    var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
    var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
    var taxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
    var dropinHelper = require('*/cartridge/scripts/digitalRiver/dropinHelper');

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    var paymentDigitalRiverId;
    var chooseSavedCard = false;
    // process payment information
    if (req.form.storedPaymentUUID
            && req.currentCustomer.raw.authenticated
            && req.currentCustomer.raw.registered
    ) {
        var array = require('*/cartridge/scripts/util/array');
        viewData.storedPaymentUUID = req.form.storedPaymentUUID;
        var paymentInstruments = req.currentCustomer.wallet.paymentInstruments;
        var paymentInstrument = array.find(paymentInstruments, function (item) {
            return viewData.storedPaymentUUID === item.UUID;
        });

        // payment instrument data saved to viewData in same format as standard SFRA credit card
        // not to disrupt further submit flow
        paymentDigitalRiverId = paymentInstrument.raw.custom.digitalRiverId;
        viewData.paymentInformation = dropinHelper.getPaymentInformationFromPaymentInstrument(paymentInstrument);
        chooseSavedCard = true;
        Transaction.wrap(function () {
            currentBasket.custom.drDropInResponse = null;
        });
    } else {
        var dropInResponse = JSON.parse(currentBasket.custom.drDropInResponse);
        paymentDigitalRiverId = dropInResponse.id;

        viewData.paymentInformation = dropinHelper.getPaymentInformationFromDropIn(dropInResponse);
    }

    viewData.saveCard = paymentForm.creditCardFields.saveCard.checked;
    var result = { ok: true };
    if (viewData.storedPaymentUUID) { // if previously saved card is used, set it as default payment
        // result = drCustomerAPI.setCustomerDefaultPayment(req.currentCustomer.raw.profile.custom.globalCommerceCustID, paymentDigitalRiverId);
    } else if (viewData.saveCard
        && req.currentCustomer.raw.authenticated
        && req.currentCustomer.raw.registered) { // if card is going to be saved, attach payment to customer for multiple use
        result = drCustomerAPI.savePaymentToCustomer(req.currentCustomer.raw.profile.custom.globalCommerceCustID, paymentDigitalRiverId);
        drCustomerAPI.setCustomerDefaultPayment(req.currentCustomer.raw.profile.custom.globalCommerceCustID, paymentDigitalRiverId); // set just saved payment method as default to make sure it will be used for payment
    }

    // for mor details see https://docs.digitalriver.com/digital-river-api/checkouts-and-orders/payment-sources/using-the-source-identifier
    var attachSourceResult = drCheckoutAPI.attachSource(currentBasket.custom.drCheckoutID, paymentDigitalRiverId);
    if (result.ok && attachSourceResult.ok) {
        var getCheckoutResult = drCheckoutAPI.getCheckout(currentBasket.custom.drCheckoutID);
        if (getCheckoutResult.ok) {
            taxHelper.saveCheckoutDataToBasket(getCheckoutResult.object, currentBasket);

            if (chooseSavedCard) {
                viewData.address.firstName.value = attachSourceResult.object.owner.firstName;
                viewData.address.lastName.value = attachSourceResult.object.owner.lastName;
                viewData.address.address1.value = getCheckoutResult.object.billTo.address.line1;
                if (getCheckoutResult.object.billTo.address.line2) {
                    viewData.address.address2.value = getCheckoutResult.object.billTo.address.line2;
                }
                viewData.address.city.value = getCheckoutResult.object.billTo.address.city;
                viewData.address.postalCode.value = getCheckoutResult.object.billTo.address.postalCode;
                viewData.address.countryCode.value = getCheckoutResult.object.billTo.address.country;
                if (getCheckoutResult.object.billTo.address.state) {
                    viewData.address.stateCode.value = getCheckoutResult.object.billTo.address.state;
                }
            }

            return {
                error: false,
                viewData: viewData
            };
        }
    }

    if (attachSourceResult.error === 409) {
        try {
            var errorData = JSON.parse(attachSourceResult.errorMessage);
            if (errorData.errors[0].code === 'invalid_parameter' && errorData.errors[0].parameter === 'taxIdentifiers') {
                result.errorMessage = [Resource.msg('error.identifier.notcompatible', 'digitalriver', null)];
            }
        } catch (e) {
            var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.checkout');
            logger.error('Failed to handle Digital River conflict response {0}', attachSourceResult.errorMessage);
        }
    }
    return {
        error: true,
        serverErrors: result.errorMessage || [Resource.msg('error.technical', 'checkout', null)]
    };
}

/**
 * Save the credit card information to login account if save card option is selected
 * @param {Object} req - The request object
 * @param {dw.order.Basket} basket - The current basket
 * @param {Object} billingData - payment information
 */
function savePaymentInformation(req, basket, billingData) {
    var dropinHelper = require('*/cartridge/scripts/digitalRiver/dropinHelper');

    if (!billingData.storedPaymentUUID
        && req.currentCustomer.raw.authenticated
        && req.currentCustomer.raw.registered
        && billingData.saveCard
        && (billingData.paymentMethod.value === 'DIGITAL_RIVER_DROPIN')
    ) {
        var customer = req.currentCustomer.raw;
        var source = JSON.parse(basket.custom.drDropInResponse);
        var saveCardResult = dropinHelper.saveDropInPaymentToWallet(source, customer);

        req.currentCustomer.wallet.paymentInstruments.push({
            paymentType: saveCardResult.custom.drPaymentType,
            creditCardHolder: saveCardResult.creditCardHolder,
            maskedCreditCardNumber: saveCardResult.maskedCreditCardNumber,
            creditCardType: saveCardResult.creditCardType,
            creditCardExpirationMonth: saveCardResult.creditCardExpirationMonth,
            creditCardExpirationYear: saveCardResult.creditCardExpirationYear,
            UUID: saveCardResult.UUID,
            creditCardNumber: Object.hasOwnProperty.call(
                saveCardResult,
                'creditCardNumber'
            )
                ? saveCardResult.creditCardNumber
                : null,
            raw: saveCardResult
        });
    }
}

exports.processForm = processForm;
exports.savePaymentInformation = savePaymentInformation;
