'use strict';

/**
 * Checks if all products are digital or not
 * @param {dw.util.Collection} productLineItems - product line items
 * @returns {boolean} result
 */
function checkDigitalProductsOnly(productLineItems) {
    var isAllDigitalProducts = true;

    for (var i = 0; i < productLineItems.length; i += 1) {
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

/**
* Resets the basket and sets error stage for payment
* @param {dw.system.Request} req - the current request object
* @param {dw.system.Response} res - the current response object
* @returns {boolean} - true if the basket is reset successfully
*/
function resetBasketOnError(req, res) {
    var URLUtils = require('dw/web/URLUtils');
    var Resource = require('dw/web/Resource');
    var Transaction = require('dw/system/Transaction');
    var currentSite = require('dw/system/Site').getCurrent();
    var currentBasket = require('dw/order/BasketMgr').getCurrentBasket();
    var taxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
    var dropinHelper = require('*/cartridge/scripts/digitalRiver/dropinHelper');
    var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
    var reqRedirectUrl = 'https://' + req.host; // adding code to get the hostname

    res.setViewData({
        errorStage: {
            stage: 'payment'
        }
    });

    if (currentBasket) {
        var drCheckout = drCheckoutAPI.createCheckout(currentBasket, currentBasket.custom.drTaxIdentifierType, true);

        if (drCheckout.ok) {
            taxHelper.saveCheckoutDataToBasket(drCheckout.object, currentBasket, true);

            var digitalRiverConfiguration = {
                currentLocaleId: req.locale.id.replace('_', '-'),
                APIKey: currentSite.getCustomPreferenceValue('drPublicKey'),
                dropInConfiguration: dropinHelper.getConfiguration({
                    basket: currentBasket,
                    customer: req.currentCustomer.raw,
                    reqUrl: reqRedirectUrl // adding host name
                }),
                cancelRedirectUrl: URLUtils.url('Checkout-Begin', 'stage', 'payment').toString(),
                paymentErrorMessage: Resource.msg('error.checkout.paynowerror', 'digitalriver', null)
            };

            res.setViewData({
                digitalRiverConfiguration: digitalRiverConfiguration
            });
        }

        Transaction.wrap(function () {
            currentBasket.custom.drOrderID = null;
        });
    }

    return true;
}

/**
 * Converts ShippingMethods to ShippingMethodModels
 * @param {dw.util.Collection} shippingMethods - ShippingMethods from ShippingShipmentModel
 * @param {dw.order.Shipment} shipment - the associated Shipment object
 * @returns {dw.util.ArrayList} - an array of ShippingMethodModels
 */
function convertShippingMethodsToModel(shippingMethods, shipment) {
    var collections = require('*/cartridge/scripts/util/collections');
    var ShippingMethodModel = require('*/cartridge/models/shipping/shippingMethod');

    var filteredMethods = [];
    var drShippingMethod;
    collections.forEach(shippingMethods, function (shippingMethod) {
        if (!shippingMethod.custom.storePickupEnabled) {
            if (shippingMethod.ID.indexOf('DRDefaultShp') < 0) {
                var model = new ShippingMethodModel(shippingMethod, shipment);
                model.isDR = false;
                model.apiShippingMethod = shippingMethod;
                filteredMethods.push(model);
            } else {
                drShippingMethod = shippingMethod;
            }
        }
    });
    var isAllDigitalProducts = checkDigitalProductsOnly(shipment.productLineItems);
    if (isAllDigitalProducts) {
        filteredMethods = filteredMethods.filter(function (shippingMethod) {
            return shippingMethod.ID.includes('DigitalProductShipment');
        });
    }
    return {
        filteredMethods: filteredMethods,
        drShippingMethod: drShippingMethod
    };
}

/**
 * Populates the custom prefs of a shipment with the details of a given shipping method
 * @param {dw.order.Shipment} shipmentArg - the target Shipment object
 * @param {dw.order.ShippingMethod} shippingMethod - the associated ShippingMethod object
 */
function populateShipmentCustomPref(shipmentArg, shippingMethod) {
    var shipment = shipmentArg;
    shipment.custom.drSQId = '';
    shipment.custom.drUniqueID = '';
    shipment.custom.drSQDescription = '';
    shipment.custom.drSQServiceLevel = '';
    shipment.custom.drSQShipFrom = '';
    shipment.custom.drSQShippingTerms = '';
    shipment.custom.drSQEstimatedArrivalTime = '';
    shipment.custom.drSQTotalAmount = '';
    if (shippingMethod.isDR) {
        shipment.custom.drSQId = shippingMethod.drID;
        shipment.custom.drUniqueID = shippingMethod.ID;
        shipment.custom.drSQDescription = shippingMethod.description;
        shipment.custom.drSQServiceLevel = shippingMethod.displayName;
        shipment.custom.drSQShipFrom = shippingMethod.shipFrom;
        shipment.custom.drSQShippingTerms = shippingMethod.shippingTerms;
        shipment.custom.drSQEstimatedArrivalTime = shippingMethod.estimatedArrivalTime;
        shipment.custom.drSQTotalAmount = shippingMethod.shippingCost;
    }
}

/**
 * Returns a boolean indicating whether the current page is a checkout page
 * @param {dw.web.HttpParameterMap} request - the current request
 * @returns {boolean} - true if the current page is a checkout page, false otherwise
 */
function isAllowedEndpoint() {
    var httpPath = request.httpPath.split('/');
    var pageURL = httpPath.pop();
    var checkoutOnly = false;
    var array = [
        'Checkout-Begin',
        'CheckoutShippingServices-UpdateShippingMethodsList',
        'CheckoutShippingServices-SelectShippingMethod',
        'CheckoutShippingServices-SubmitShipping',
        'DigitalRiver-PurchaseType',
        'DigitalRiver-TaxIdentifierConfig',
        'DigitalRiver-TaxIdentifierApply',
        'DigitalRiver-TaxIdentifierDelete',
        'CheckoutServices-SubmitPayment'
    ];

    if (array.indexOf(pageURL) > -1) {
        checkoutOnly = true;
    }
    return checkoutOnly;
}

module.exports = {
    checkDigitalProductsOnly: checkDigitalProductsOnly,
    getCountry: getCountry,
    getAggregatePriceItem: getAggregatePriceItem,
    resetBasketOnError: resetBasketOnError,
    convertShippingMethodsToModel: convertShippingMethodsToModel,
    populateShipmentCustomPref: populateShipmentCustomPref,
    isAllowedEndpoint: isAllowedEndpoint
};
