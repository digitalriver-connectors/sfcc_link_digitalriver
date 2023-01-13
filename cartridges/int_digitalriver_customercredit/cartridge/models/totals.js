'use strict';

var parent = module.superModule;
var formatMoney = require('dw/util/StringUtils').formatMoney;

/**
 * Gets amount from price adjusment or returns 0 if no adjustment
 * @param {dw.value.Money} money price of priceAdjustment
 * @returns {Object} an object that contains the value and formatted value of the price adjustment
 */
function getAdjustmentValues(money) {
    return {
        value: money.value,
        formatted: formatMoney(money)
    };
}

/**
 * Get Customer Credit from DR response
 * @param {dw.order.lineItemContainer} lineItemContainer - The current user's line item container
 * @returns {Object} - SFRA Order model
 */
function getCustomerCredit(lineItemContainer) {
    var Money = require('dw/value/Money');

    if (!lineItemContainer) return null;

    var drCheckoutData = null;
    try {
        drCheckoutData = JSON.parse(lineItemContainer.custom.drCheckoutData);
    } catch (error) {
        return null;
    }

    if (!drCheckoutData || !drCheckoutData.sources) return null;

    var currencyCode = lineItemContainer.getCurrencyCode();

    return drCheckoutData.sources
        .filter(function (source) {
            return source.type === 'customerCredit';
        })
        .map(function (customerCredit) {
            var creditMoneyAmount = new Money(customerCredit.amount, currencyCode);
            return getAdjustmentValues(creditMoneyAmount);
        });
}

/**
 * Extends totals calculation model to handle customer credits
 *
 * @param {dw.order.lineItemContainer} lineItemContainer - The current user's line item container
 */
function Totals(lineItemContainer) {
    parent.apply(this, arguments);

    var dropInIsEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('drUseDropInFeature');
    if (dropInIsEnabled && lineItemContainer) {
        var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');

        this.customerCredit = getCustomerCredit(lineItemContainer);
        this.adjustedGrandTotal = drTaxHelper.getNonGiftCertificatePriceTotal(lineItemContainer);
    }
}

module.exports = Totals;
