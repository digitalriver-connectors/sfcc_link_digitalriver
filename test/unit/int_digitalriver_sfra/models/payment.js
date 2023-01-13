'use strict';

var assert = require('chai').assert;
var mockSuperModule = require('../../../mocks/mockModuleSuperModule');

var BasePaymentModelMock = function (basket) {
    var parentOutputMock = basket.parentOutputMock;
    for (var key in parentOutputMock) { // eslint-disable-line
        this[key] = JSON.parse(JSON.stringify(parentOutputMock[key]));
    }
};

describe('payment model', function () {
    var PaymentModel;

    before(function () {
        mockSuperModule.create(BasePaymentModelMock);
        PaymentModel = require('../../../../cartridges/int_digitalriver_sfra/cartridge/models/payment');
    });

    after(function () {
        mockSuperModule.remove();
    });

    it('should populate card data of DIGITAL_RIVER_DROPIN payment instrument if DR payment type is creditCard', function () {
        var basketPaymentInstruments = [
            {
                creditCardNumberLastDigits: '2222',
                creditCardHolder: 'Handsome guy',
                creditCardExpirationYear: 2025,
                creditCardType: 'Visa',
                maskedCreditCardNumber: '************2222',
                paymentMethod: 'DIGITAL_RIVER_DROPIN',
                creditCardExpirationMonth: 1,
                custom: {
                    drPaymentType: 'creditCard'
                },
                paymentTransaction: {
                    amount: {
                        value: 0
                    }
                }
            }
        ];

        var parentOutputInstruments = [
            {
                paymentMethod: 'DIGITAL_RIVER_DROPIN',
                amount: 0
            }
        ];

        var basket = {
            paymentInstruments: basketPaymentInstruments,
            parentOutputMock: {
                selectedPaymentInstruments: parentOutputInstruments
            }
        };

        var result = new PaymentModel(basket);

        assert.equal(result.selectedPaymentInstruments[0].paymentType, 'creditCard');
        assert.equal(result.selectedPaymentInstruments[0].lastFour, '2222');
        assert.equal(result.selectedPaymentInstruments[0].owner, 'Handsome guy');
        assert.equal(result.selectedPaymentInstruments[0].expirationYear, 2025);
        assert.equal(result.selectedPaymentInstruments[0].type, 'Visa');
        assert.equal(result.selectedPaymentInstruments[0].maskedCreditCardNumber, '************2222');
        assert.equal(result.selectedPaymentInstruments[0].expirationMonth, 1);
    });

    it('should set payment type for non-card DIGITAL_RIVER_DROPIN payment instrument', function () {
        var basketPaymentInstruments = [
            {
                creditCardNumberLastDigits: null,
                creditCardHolder: null,
                creditCardExpirationYear: null,
                creditCardType: null,
                maskedCreditCardNumber: null,
                paymentMethod: 'DIGITAL_RIVER_DROPIN',
                creditCardExpirationMonth: null,
                custom: {
                    drPaymentType: 'payPal'
                },
                paymentTransaction: {
                    amount: {
                        value: 0
                    }
                }
            }
        ];

        var parentOutputInstruments = [
            {
                paymentMethod: 'DIGITAL_RIVER_DROPIN',
                amount: 0
            }
        ];

        var basket = {
            paymentInstruments: basketPaymentInstruments,
            parentOutputMock: {
                selectedPaymentInstruments: parentOutputInstruments
            }
        };

        var result = new PaymentModel(basket);

        assert.equal(result.selectedPaymentInstruments[0].paymentType, 'payPal');
    });

    it('should ignore payment instruments which are not DIGITAL_RIVER_DROPIN', function () {
        var basketPaymentInstruments = [
            {
                creditCardNumberLastDigits: '2222',
                creditCardHolder: 'Handsome guy',
                creditCardExpirationYear: 2025,
                creditCardType: 'Visa',
                maskedCreditCardNumber: '************2222',
                paymentMethod: 'CREDIT_CARD',
                creditCardExpirationMonth: 1,
                custom: {
                    drPaymentType: 'addressedByModel'
                },
                paymentTransaction: {
                    amount: {
                        value: 0
                    }
                }
            }
        ];

        var parentOutputInstruments = [
            {
                paymentMethod: 'CREDIT_CARD',
                amount: 0
            }
        ];

        var basket = {
            paymentInstruments: basketPaymentInstruments,
            parentOutputMock: {
                selectedPaymentInstruments: parentOutputInstruments
            }
        };

        var result = new PaymentModel(basket);

        assert.equal(result.selectedPaymentInstruments[0].paymentType, null);
    });
});
