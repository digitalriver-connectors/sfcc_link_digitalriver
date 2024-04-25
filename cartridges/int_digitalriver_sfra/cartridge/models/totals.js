'use strict';

var parent = module.superModule;

var HashMap = require('dw/util/HashMap');
var Template = require('dw/util/Template');
var Money = require('dw/value/Money');
var formatMoney = require('dw/util/StringUtils').formatMoney;
var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
var collections = require('*/cartridge/scripts/util/collections');

/**
 * Gets the order discount amount by subtracting the basket's total including the discount from
 *      the basket's total excluding the order discount.
 * @param {dw.order.LineItemCtnr} lineItemContainer - Current users's basket
 * @param {Array} amounts - array of amount of Digital River PriceAdjustments
 * @returns {Object} an object that contains the value and formatted value of the order discount
 */
function getOrderLevelDiscountWithoutDRAdjustment(lineItemContainer, amounts) {
    var totalExcludingOrderDiscount = lineItemContainer.getAdjustedMerchandizeTotalPrice(false);
    var totalIncludingOrderDiscount = lineItemContainer.getAdjustedMerchandizeTotalPrice(true);
    var totalDrDiscount = new Money(0, lineItemContainer.currencyCode);
    amounts.forEach(function (amount) {
        totalDrDiscount = totalDrDiscount.add(amount);
    });
    var orderDiscount = totalExcludingOrderDiscount.add(totalDrDiscount).subtract(totalIncludingOrderDiscount);

    return {
        value: orderDiscount.value,
        formatted: formatMoney(orderDiscount)
    };
}

/**
 * Transforms priceAdjustment into discount objects (except DR adjustments)
 * @param {dw.util.Collection} collection - a collection of price adjustments
 * @returns {Array} of price adjustments
 */
function collectDiscountsExceptDRAdjustments(collection) {
    var result = [];
    collections.forEach(collection, function (item) {
        if (!item.basedOnCoupon && !drTaxHelper.isDrAdjustment(item.promotionID)) {
            result.push({
                UUID: item.UUID,
                lineItemText: item.lineItemText,
                price: formatMoney(item.price),
                type: 'promotion',
                callOutMsg: (typeof item.promotion !== 'undefined' && item.promotion !== null) ? item.promotion.calloutMsg : ''
            });
        }
    });

    return result;
}

/**
 * creates an array of discounts.
 * @param {dw.order.LineItemCtnr} lineItemContainer - the current line item container
 * @returns {Array} an array of objects containing promotion and coupon information
 */
function getDiscounts(lineItemContainer) {
    var couponDiscounts = collections.map(lineItemContainer.couponLineItems, function (couponLineItem) {
        var priceAdjustments = collections.map(couponLineItem.priceAdjustments, function (priceAdjustment) {
            return { callOutMsg: (typeof priceAdjustment.promotion !== 'undefined' && priceAdjustment.promotion !== null) ? priceAdjustment.promotion.calloutMsg : '' };
        });
        return {
            type: 'coupon',
            UUID: couponLineItem.UUID,
            couponCode: couponLineItem.couponCode,
            applied: couponLineItem.applied,
            valid: couponLineItem.valid,
            relationship: priceAdjustments
        };
    });

    var orderDiscounts = collectDiscountsExceptDRAdjustments(lineItemContainer.priceAdjustments);
    var shippingDiscounts = collectDiscountsExceptDRAdjustments(lineItemContainer.allShippingPriceAdjustments);

    return couponDiscounts.concat(orderDiscounts).concat(shippingDiscounts);
}

/**
 * create the discount results html
 * @param {Array} discounts - an array of objects that contains coupon and priceAdjustment
 * information
 * @returns {string} The rendered HTML
 */
function getDiscountsHtml(discounts) {
    var context = new HashMap();
    var object = { totals: { discounts: discounts } };

    Object.keys(object).forEach(function (key) {
        context.put(key, object[key]);
    });

    var template = new Template('cart/cartCouponDisplay');
    return template.render(context).text;
}

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
 * Accepts a total object and formats the value
 * @param {dw.value.Money} total - Total price of the cart
 * @returns {string} the formatted money value
 */
function getTotals(total) {
    return !total.available ? '-' : formatMoney(total);
}

/**
 * Extends totals calculation model to handle possible duty provided by Digital River and implemented
 * as positive amount Price Adjustment
 *
 * @param {dw.order.lineItemContainer} lineItemContainer - The current user's line item container
 */
function Totals(lineItemContainer) {
    parent.apply(this, arguments);

    var dropInIsEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('drUseDropInFeature');
    if (dropInIsEnabled && lineItemContainer) {
        var drOrderAdjustments = [];
        var currentShipment = lineItemContainer.shipments[0];
        var dutyPriceAdjustment = currentShipment.getShippingLineItem('digitalRiver_duty');
        var importerTaxPriceAdjustment = currentShipment.getShippingLineItem('digitalRiver_importerTax');
        var totalFeesPriceAdjustment = lineItemContainer.getPriceAdjustmentByPromotionID(drTaxHelper.FEES_ADJUSTMENT);
        var totalTaxDiscount = drTaxHelper.getTaxDiscount(lineItemContainer);
        var currencyCode = lineItemContainer.getCurrencyCode();
        var dutyMoney = dutyPriceAdjustment ? dutyPriceAdjustment.getPrice() : new Money(0, currencyCode);
        var importerTaxMoney = importerTaxPriceAdjustment ? importerTaxPriceAdjustment.getPrice() : new Money(0, currencyCode);
        var totalFeesMoney = totalFeesPriceAdjustment ? totalFeesPriceAdjustment.getPrice() : new Money(0, currencyCode);
        var totalTaxAdjustmentMoney = new Money((totalTaxDiscount || 0), currencyCode);

        if (totalFeesPriceAdjustment) drOrderAdjustments.push(totalFeesMoney);

        if (drOrderAdjustments.length > 0) {
            this.orderLevelDiscountTotal = getOrderLevelDiscountWithoutDRAdjustment(lineItemContainer, drOrderAdjustments);
            this.discounts = getDiscounts(lineItemContainer);
            this.discountsHtml = getDiscountsHtml(this.discounts);
        }

        if (dutyPriceAdjustment || importerTaxPriceAdjustment) {
            var DRAdjustmentAmount = dutyMoney.add(importerTaxMoney);
            if (this.totalShippingCost !== '-') {
                var totalShippingAmount = lineItemContainer.shippingTotalPrice.subtract(DRAdjustmentAmount);
                this.totalShippingCost = totalShippingAmount ? formatMoney(totalShippingAmount) : '-';
            }
        }

        this.duty = getAdjustmentValues(dutyMoney);
        this.importerTax = getAdjustmentValues(importerTaxMoney);
        this.totalFees = getAdjustmentValues(totalFeesMoney);
        this.isImporterOfRecordTax = drTaxHelper.isImporterOfRecordTax(lineItemContainer);
        this.drTaxDiscountTotal = getAdjustmentValues(totalTaxAdjustmentMoney);
        this.grandTotal = getTotals(lineItemContainer.totalGrossPrice.add(totalTaxAdjustmentMoney));
        this.isZeroTotal = lineItemContainer.totalGrossPrice.add(totalTaxAdjustmentMoney).valueOrNull === 0;
    }
}

module.exports = Totals;
