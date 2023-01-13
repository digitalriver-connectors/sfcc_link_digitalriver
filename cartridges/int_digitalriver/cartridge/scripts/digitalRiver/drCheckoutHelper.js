/**
 * Checks if all products are digital or not
 * @param {dw.util.Collection} productLineItems - product line items
 * @returns {boolean} result
 */
function checkDigitalProductsOnly(productLineItems) {
    var isAllDigitalProducts = true;

    for (var i = 0; i < productLineItems.length; i++) {
        var pli = productLineItems[i];

        if (pli.product !== null) {
            var isNotDigitalProduct = !pli.product.custom.drDigitalProduct;

            if (isNotDigitalProduct) {
                isAllDigitalProducts = false;
                break;
            }
        }
    }

    return isAllDigitalProducts;
}

/**
 * Returns shipping country in case of non-digital cart or billing country in case of digital cart
 * @param {dw.order.Basket} basket - current basket
 * @returns {boolean} result
 */
function getCountry(basket) {
    if (!basket) {
        return null;
    }

    var isDigitalCart = checkDigitalProductsOnly(basket.productLineItems);
    var drCountry = null;

    if (isDigitalCart) {
        var billingAddress = basket.billingAddress;
        drCountry = billingAddress && billingAddress.countryCode.value;
    } else if (basket.shipments) {
        var shippingAddress = basket.shipments[0].shippingAddress;
        drCountry = shippingAddress && shippingAddress.countryCode.value;
    }

    return drCountry;
}

/**
 * get agrigate price item
 * @param {dw.order.ProductLineItem} item - ProductLineItem
 * @param {string} currencyCode - ISO currency code
 * @returns {dw.value.Money} - agrigate price
 */
function getAggregatePriceItem(item, currencyCode) {
    var Money = require('dw/value/Money');
    if (item.optionProductLineItem) return null;

    var aggregatePrice = item.getAdjustedPrice();
    var totalOptionsCost = new Money(0, currencyCode); // aggregate price for all options to add it to parent item price
    if (item.optionProductLineItems.length !== 0) {
        var optionIterator = item.optionProductLineItems.iterator();
        while (optionIterator.hasNext()) {
            var option = optionIterator.next();
            var optionCost = option.adjustedPrice;
            totalOptionsCost = totalOptionsCost.add(optionCost);
        }
    }

    if (totalOptionsCost.value > 0) {
        aggregatePrice = aggregatePrice.add(totalOptionsCost);
    }
    return aggregatePrice;
}

module.exports = {
    checkDigitalProductsOnly: checkDigitalProductsOnly,
    getCountry: getCountry,
    getAggregatePriceItem: getAggregatePriceItem
};
