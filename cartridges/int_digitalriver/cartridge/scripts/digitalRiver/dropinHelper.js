'use strict';

/**
* Returns object with configuration to render DropIn feature
* @param {Object} params - object with current basket, session id
* @returns {Object} - configuration for DropIn
*/
function getConfiguration(params) {
    var baseUrl = params.reqUrl;
    var URLUtils = require('dw/web/URLUtils');
    var currentBasket = params.basket ? params.basket : require('dw/order/BasketMgr').getCurrentBasket();
    var currentCustomer = params.customer ? params.customer : null;
    var email = currentBasket.getCustomerEmail() || currentBasket.getCustomer().getProfile().getEmail();
    var configuration = {};
    var checkoutHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var drPaymentSessionId = currentBasket.custom.drPaymentSessionId;
    // Redirect Flow 2.6 - START
    if (email && currentBasket.custom.drPaymentSessionId && checkoutHelpers.getIsRedirectFlow()) {
        configuration = {
            sessionId: currentBasket.custom.drPaymentSessionId, // used value from digitalRiverCheckout.createCheckout()
            options: {
                redirect: {
                    disableAutomaticRedirects: checkoutHelpers.getIsRedirectFlow(),
                    returnUrl: baseUrl + URLUtils.url('Checkout-Begin', 'drPaymentSessionId', drPaymentSessionId).toString(),
                    cancelUrl: baseUrl + URLUtils.url('Checkout-Begin', 'drPaymentSessionId', drPaymentSessionId).toString()
                },
                showSavePaymentAgreement: (currentCustomer && currentCustomer.authenticated)
            }
        };
    // Redirect Flow 2.6 Stop
    } else if (email && currentBasket.custom.drPaymentSessionId) {
        configuration = {
            sessionId: currentBasket.custom.drPaymentSessionId, // used value from digitalRiverCheckout.createCheckout()
            options: {
                showSavePaymentAgreement: (currentCustomer && currentCustomer.authenticated)
            }
        };
    }

    return configuration;
}

/**
* Returns object from DR saved in basket
* @param {Object} params - object with current basket
* @returns {Object} - dropIn response
*/
function getDropInResponseObject(params) {
    var currentBasket = params.basket ? params.basket : require('dw/order/BasketMgr').getCurrentBasket();
    var dropInResponseObject = JSON.parse(currentBasket.custom.drDropInResponse);

    return dropInResponseObject;
}

/**
* Returns object with values to show on confirmation page for payment section
* @param {Object} params - object with current basket
* @returns {Object} - values for pdict
*/
function getDropInSummary(params) {
    var currentBasket = params && params.basket ? params.basket : require('dw/order/BasketMgr').getCurrentBasket();
    var dropInResponseObject = getDropInResponseObject({
        basket: currentBasket
    });
    var payment = {
        isCC: dropInResponseObject.type === 'creditCard',
        type: dropInResponseObject.type,
        details: dropInResponseObject[dropInResponseObject.type]
    };

    if (payment.isCC) {
        var maskedCreditCardNumber = '************' + payment.details.lastFourDigits;
        payment.details.maskedCreditCardNumber = maskedCreditCardNumber;
    }

    return payment;
}

/**
 * Collects payment data necessary for checkout from payment instrument saved in customer wallet
 * @param {Object} paymentInstrument object that contains info about the current customer's payment instrument
 * @returns {Object} payment information acceptable for further payment submit
 */
function getPaymentInformationFromPaymentInstrument(paymentInstrument) {
    var result = {};
    var paymentType = paymentInstrument.raw.custom.drPaymentType;

    switch (paymentType) {
        case 'creditCard':
            result = {
                cardType: {
                    value: paymentInstrument.creditCardType
                },
                cardNumber: {
                    value: paymentInstrument.creditCardNumber
                },
                expirationMonth: {
                    value: paymentInstrument.creditCardExpirationMonth
                },
                expirationYear: {
                    value: paymentInstrument.creditCardExpirationYear
                },
                creditCardToken: paymentInstrument.creditCardToken
            };
            break;
        default: // extend switch with new cases or implement default to save specific data for other payment types
    }

    result.paymentType = paymentType;
    return result;
}

/**
 * Adapts card owner name to fulfill requirements of length
 * @param {Object} source drop-in parameter passed to onSuccess listener
 * @returns {string} card owner name
 */
function getOwnerName(source) {
    var ownerFullName = source.owner.firstName + ' ' + source.owner.lastName;
    if (ownerFullName.length > 16) {
        // If full name longer that required, first Name is shortened to first letter.
        ownerFullName = source.owner.firstName.slice(0, 1) + '. ' + source.owner.lastName;
    }
    return ownerFullName.substring(0, 16);
}

/**
 * Collects payment data necessary for checkout from Digital River drop-in
 * @param {Object} source source provided by Digital River drop-in form
 * @returns {Object} payment information acceptable for further payment submit
 */
function getPaymentInformationFromDropIn(source) {
    var result = {};

    switch (source.type) {
        case 'creditCard':
            var CC = source.creditCard;
            result = {
                cardType: {
                    value: CC.brand
                },
                cardNumber: {
                    value: '************' + CC.lastFourDigits
                },
                expirationMonth: {
                    value: CC.expirationMonth
                },
                expirationYear: {
                    value: CC.expirationYear
                },
                creditCardToken: source.id
            };
            break;
        default: // extend switch with new cases or default if to save specific data for other payment types
    }

    result.paymentType = source.type;
    return result;
}

/**
 * Get converted credit card type to SFCC format
 * @param {string} creditCardBrand - Digital River credit card type format
 * @returns {string|null} - SFCC credit card type format
 */
function getCardTypeReduction(creditCardBrand) {
    var result = null;
    if (!empty(creditCardBrand)) {
        switch (creditCardBrand.toLowerCase()) {
            case 'visa':
                result = 'Visa';
                break;
            case 'mastercard':
                result = 'MasterCard';
                break;
            case 'americanexpress':
                result = 'Amex';
                break;
            case 'discover':
                result = 'Discover';
                break;
            default:
                result = creditCardBrand;
                break;
        }
    }

    return result;
}

/**
 * Saves credit card payment instrument in customer wallet with custom atribute digitalRiverId
 * @param {Object} source payment source provided by Digital River Drop-in
 * @param {dw.customer.Customer} customer current customer
 * @returns {dw.order.PaymentInstrument} payment instrument created in customer wallet
 *
 */
function saveDropInPaymentToWallet(source, customer) {
    var Transaction = require('dw/system/Transaction');

    var wallet = customer.profile.getWallet();
    var paymentInstrument;

    return Transaction.wrap(function () {
        paymentInstrument = wallet.createPaymentInstrument('DIGITAL_RIVER_DROPIN');
        paymentInstrument.custom.digitalRiverId = source.id;
        paymentInstrument.custom.drPaymentType = source.type;

        switch (source.type) {
            case 'creditCard':
                paymentInstrument.setCreditCardHolder(getOwnerName(source));
                paymentInstrument.setCreditCardNumber('************' + source.creditCard.lastFourDigits);
                paymentInstrument.setCreditCardType(getCardTypeReduction(source.creditCard.brand));
                paymentInstrument.setCreditCardExpirationMonth(source.creditCard.expirationMonth);
                paymentInstrument.setCreditCardExpirationYear(source.creditCard.expirationYear);
                paymentInstrument.setCreditCardToken(source.id);
                break;
            default: // extend switch with new cases or default if to save specific data for other payment types
                paymentInstrument.setCreditCardHolder(getOwnerName(source));
                paymentInstrument.setCreditCardNumber('-');
                paymentInstrument.setCreditCardType(source.type);
                paymentInstrument.setCreditCardToken(source.id);
        }
        return paymentInstrument;
    });
}

exports.getConfiguration = getConfiguration;
exports.getDropInResponseObject = getDropInResponseObject;
exports.getDropInSummary = getDropInSummary;
exports.getPaymentInformationFromPaymentInstrument = getPaymentInformationFromPaymentInstrument;
exports.getPaymentInformationFromDropIn = getPaymentInformationFromDropIn;
exports.saveDropInPaymentToWallet = saveDropInPaymentToWallet;
