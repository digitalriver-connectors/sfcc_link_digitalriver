'use strict';

var parent = module.superModule;
var output = {};
Object.keys(parent).forEach(function (key) {
    output[key] = parent[key];
});
var Status = require('dw/system/Status');
var Money = require('dw/value/Money');
var ProductLineItem = require('dw/order/ProductLineItem');
var ShippingLineItem = require('dw/order/ShippingLineItem');
var PriceAdjustment = require('dw/order/PriceAdjustment');
var collections = require('*/cartridge/scripts/util/collections');
var taxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
var ShippingMgr = require('dw/order/ShippingMgr');
var Transaction = require('dw/system/Transaction');

/**
 * Calculates the shipping cost for the given basket
 * @param {dw.order.Basket} basket - the target Basket object
 * @returns {dw.system.Status} the status of the operation
 */
output.calculateShipping = function (basket) {
    var status = new Status(Status.OK);
    try {
        Transaction.wrap(function () {
            for (let i = 0; i < basket.shipments.length; i += 1) {
                var shipment = basket.shipments[i];
                if (shipment && shipment.shippingMethodID && shipment.shippingMethodID.indexOf('DRDefaultShp') > -1) {
                    ShippingMgr.applyShippingCost(basket);
                    var priceStringified = shipment.custom.drSQTotalAmount;
                    var shippingPrice;
                    if (priceStringified) {
                        if (shipment.shippingMethodID === 'DRDefaultShpJPY') {
                            shippingPrice = parseFloat(priceStringified.replace(/[^\d.]/g, ''));
                        } else {
                            shippingPrice = Number(priceStringified.replace(/[^0-9,.-]+/g, '').replace(',', '.'));
                        }
                        var shippingLineItem = shipment.shippingLineItems[0];
                        shippingLineItem.setPriceValue(shippingPrice);
                        var taxRate = shippingLineItem.getTaxRate();
                        var updatedTax = shippingPrice * taxRate;
                        shippingLineItem.updateTaxAmount(new Money(updatedTax, basket.currencyCode));
                    }
                } else {
                    ShippingMgr.applyShippingCost(basket);
                }
            }
            basket.updateTotals();
        });
    } catch (e) {
        status = new Status(Status.ERROR);
    }
    return status;
};
/**
 * Function extends original calculateTax hook to update basket items with taxes provided by Digital River
 * @param {dw.order.Basket} basket The basket containing the elements for which taxes need to be calculated
 * @returns {dw.system.Status} calculation status
 */
output.calculateTax = function (basket) {
    var DigitalRiverEnabled = require('dw/system/Site').getCurrent().getCustomPreferenceValue('drUseDropInFeature');

    var checkoutData = taxHelper.parseCheckoutData(basket.custom.drCheckoutData);

    if (!DigitalRiverEnabled || !checkoutData) { // use default tax calculation if Digital River is disabled or checkout hasn't been created yet
        return parent.calculateTax.apply(null, arguments);
    }
    var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.checkout');

    if (!taxHelper.checkoutDataIsValid(checkoutData, basket)) {
        return parent.calculateTax.apply(null, arguments);
    }

    // taxHelper.updateTaxPromotion(basket, checkoutData);

    var currency = basket.getCurrencyCode();
    var shippingTaxAmount = checkoutData.shippingTax;
    var itemNavigation = checkoutData.items.map(function (item) { return item.digitalRiverID; });
    var lineItems = basket.getAllLineItems();

    collections.forEach(lineItems, function (lineItem) {
        if (lineItem instanceof ProductLineItem) { // updating taxes for product line items
            var taxAmount = 0;
            var taxRate = 0;
            if (!lineItem.optionProductLineItem) { // option products line items will have 0 taxes while parent item taxes will include options cost
                var sourceItem = checkoutData.items[itemNavigation.indexOf(lineItem.custom.digitalRiverID)];
                if (sourceItem) {
                    taxAmount = sourceItem.tax.amount;
                    taxRate = sourceItem.tax.rate;
                }
            }
            if (!empty(taxRate)) {
                lineItem.updateTax(taxRate);
            }
            lineItem.updateTaxAmount(new Money(taxAmount, currency));
        } else if (lineItem instanceof ShippingLineItem
            && lineItem.ID !== 'digitalRiver_duty'
            && lineItem.ID !== 'digitalRiver_importerTax'
        ) {
            lineItem.updateTaxAmount(new Money(shippingTaxAmount, currency));
        } else if (lineItem instanceof PriceAdjustment) { // price adjustments except Fees will have 0 taxes
            if (!taxHelper.isDrAdjustment(lineItem.promotionID)) {
                lineItem.updateTax(0);
            }
        } else {
            lineItem.updateTax(0);
            logger.warn('Taxes for {0} set to zero. Digital River tax calculation is not supported by this implementation', lineItem.constructor.name);
        }
    });
    return new Status(Status.OK);
};

module.exports = output;
