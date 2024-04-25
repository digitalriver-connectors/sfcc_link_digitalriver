'use strict';

var server = require('server');
server.extend(module.superModule);

/**
 * function decorator. Added formated amount according to the regional settings
 * @param {Array} customerCreditSources - Array of DigitalRiver customer credit sources
 * @returns {Array} - Array of DigitalRiver customer credit sources with formated amount
 */
function addFormatedAmount(customerCreditSources) {
    var Money = require('dw/value/Money');
    var BasketMgr = require('dw/order/BasketMgr');
    var currentBasket = BasketMgr.getCurrentBasket();
    if (currentBasket) {
        var currencyCode = currentBasket.getCurrencyCode();
        if (customerCreditSources && Array.isArray(customerCreditSources) && currencyCode) {
            customerCreditSources.forEach(function (source) {
                var creditMoneyAmount = new Money(source.amount, currencyCode);
                // eslint-disable-next-line no-param-reassign
                source.formatted = creditMoneyAmount.toFormattedString();
            });
        }
    }
    return customerCreditSources;
}

server.post('AddCustomerCredit', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Transaction = require('dw/system/Transaction');
    var Money = require('dw/value/Money');
    var Resource = require('dw/web/Resource');
    var collections = require('*/cartridge/scripts/util/collections');
    var secondarySourceHelper = require('*/cartridge/scripts/digitalRiver/secondarySource');
    var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
    var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
    var currentBasket = BasketMgr.getCurrentBasket();
    var drCheckoutId = currentBasket.custom.drCheckoutID;
    /*
        @IG:
        Depending on your implementation, change values of primarySourceId and customerCreditAmount
    */
    var primarySourceId = req.form.primarySourceId;
    var customerCreditAmount = Number(req.form.customerCreditAmount.replace(/,/g, '.'));
    var customerCreditPI;

    if (Number.isNaN(customerCreditAmount)) {
        res.json({
            error: true,
            fieldErrors: Resource.msg('msg.error.customercredit.value', 'digitalriver', null)
        });
        return next();
    }

    /*
        @IG:
        Modify this code to create a new payment instrument for customer credit depending on your implementation of secondary payments
    */
    Transaction.wrap(function () {
        customerCreditPI = currentBasket.createGiftCertificatePaymentInstrument('customer_credit_code', new Money(customerCreditAmount, currentBasket.getCurrencyCode()));
        customerCreditPI.custom.drPaymentType = 'customerCredit';
    });

    // if we have primary payment source already attached to the checkout, it should be deleted before adding customer credits
    if (primarySourceId) {
        var deleteSourceResult = drCheckoutAPI.deleteSource(drCheckoutId, primarySourceId);
        if (!deleteSourceResult.ok) {
            res.json({
                error: true,
                errorMessage: Resource.msg('msg.error.customercredit.notadded', 'digitalriver', null)
            });
            return next();
        }

        var paymentInstruments = currentBasket.getPaymentInstruments();
        var primarySourcePI = collections.find(paymentInstruments, function (paymentInstrument) {
            return paymentInstrument.custom.drSourceId === primarySourceId;
        });
        Transaction.wrap(function () {
            currentBasket.removePaymentInstrument(primarySourcePI);
        });
    }

    // making API call to DR to create new customer credit source
    var createSourceResult = secondarySourceHelper.createCustomerCreditSource(customerCreditPI, customerCreditAmount);
    if (createSourceResult.error) {
        res.json({
            error: true,
            errorMessage: createSourceResult.errorMessage
        });
        return next();
    }

    // making API call to DR in order to attach created customer credit source to the current checkout
    var attachSourceResult = drCheckoutAPI.attachSource(drCheckoutId, createSourceResult.sourceId);
    if (!attachSourceResult.ok) {
        res.json({
            error: true,
            errorMessage: Resource.msg('msg.error.customercredit.notadded', 'digitalriver', null)
        });
        return next();
    }

    // making API call to DR to get current checkout data
    var getCheckoutResult = drCheckoutAPI.getCheckout(drCheckoutId);
    if (!getCheckoutResult.ok) {
        res.json({
            error: true,
            errorMessage: Resource.msg('msg.error.customercredit.notadded', 'digitalriver', null)
        });
        return next();
    }

    // updating basket checkout data with data from DR checkout response
    drTaxHelper.updateCheckoutDataInBasket({
        sources: getCheckoutResult.object.payment.sources,
        amountRemainingToBeContributed: getCheckoutResult.object.payment.session.amountRemainingToBeContributed
    });

    var customerCreditSources = getCheckoutResult.object.payment.sources.filter(function (source) {
        return source.type === 'customerCredit';
    });

    res.json({
        success: true,
        customerCreditSources: addFormatedAmount(customerCreditSources),
        adjustedGrandTotal: drTaxHelper.getNonGiftCertificatePriceTotal(currentBasket),
        amountRemainingToBeContributed: getCheckoutResult.object.payment.session.amountRemainingToBeContributed
    });

    return next();
});

server.post('RemoveCustomerCredit', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Resource = require('dw/web/Resource');
    var secondarySourceHelper = require('*/cartridge/scripts/digitalRiver/secondarySource');
    var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
    var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
    var currentBasket = BasketMgr.getCurrentBasket();
    /*
        @IG:
        Depending on your implementation, change the value of sourceId
    */
    var sourceId = req.form.sourceId;
    var drCheckoutId = currentBasket.custom.drCheckoutID;

    // making API call to DR to delete customer credit source from checkout
    var removeSourceResult = secondarySourceHelper.removeCustomerCreditSource(drCheckoutId, sourceId);

    if (!removeSourceResult) {
        res.json({
            error: true,
            errorMessage: Resource.msg('msg.error.customercredit.notremoved', 'digitalriver', null)
        });
        return next();
    }

    // making API call to DR to get actual checkout data
    var getCheckoutResult = drCheckoutAPI.getCheckout(drCheckoutId);
    if (!getCheckoutResult.ok) {
        res.json({
            error: true,
            errorMessage: Resource.msg('msg.error.customercredit.notremoved', 'digitalriver', null)
        });
        return next();
    }

    // updating basket checkout data with data from DR checkout response
    var sources = getCheckoutResult.object.payment.sources || [];
    drTaxHelper.updateCheckoutDataInBasket(
        {
            sources: sources,
            amountRemainingToBeContributed: getCheckoutResult.object.payment.session.amountRemainingToBeContributed
        }
    );
    var customerCreditSources = sources.filter(function (source) {
        return source.type === 'customerCredit';
    });

    res.json({
        success: true,
        customerCreditSources: addFormatedAmount(customerCreditSources),
        adjustedGrandTotal: drTaxHelper.getNonGiftCertificatePriceTotal(currentBasket),
        amountRemainingToBeContributed: getCheckoutResult.object.payment.session.amountRemainingToBeContributed
    });

    return next();
});

server.get('CustomerCredits', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Resource = require('dw/web/Resource');
    var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
    var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
    var currentBasket = BasketMgr.getCurrentBasket();
    var drCheckoutId = currentBasket.custom.drCheckoutID;

    // making API call to DR to get checkout data
    var getCheckoutResult = drCheckoutAPI.getCheckout(drCheckoutId);

    if (!getCheckoutResult.ok) {
        res.json({
            error: true,
            errorMessage: Resource.msg('msg.error.load.sources', 'digitalriver', null)
        });
        return next();
    }

    var sources = getCheckoutResult.object.payment.sources || [];
    var customerCreditSources = sources.filter(function (source) {
        return source.type === 'customerCredit';
    });
    var primarySource = sources.find(function (source) {
        return source.type !== 'customerCredit';
    });

    res.json({
        success: true,
        customerCreditSources: addFormatedAmount(customerCreditSources),
        adjustedGrandTotal: drTaxHelper.getNonGiftCertificatePriceTotal(currentBasket),
        primarySourceId: primarySource && primarySource.id,
        amountRemainingToBeContributed: getCheckoutResult.object.payment.session.amountRemainingToBeContributed
    });

    return next();
});

module.exports = server.exports();
