'use strict';

var parent = module.superModule;
var output = {};
Object.keys(parent).forEach(function (key) {
    output[key] = parent[key];
});

var collections = require('*/cartridge/scripts/util/collections');

var ShippingMgr = require('dw/order/ShippingMgr');

var ShippingQuotesHelper = require('*/cartridge/scripts/digitalRiver/drShippingQuotesHelper');

var Site = require('dw/system/Site');

var ArrayList = require('dw/util/ArrayList');

var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
// Public (class) static model functions

/**
 * Returns the first shipping method (and maybe prevent in store pickup)
 * @param {dw.util.Collection} methods - Applicable methods from ShippingShipmentModel
 * @param {boolean} filterPickupInStore - whether to exclude PUIS method
 * @returns {dw.order.ShippingMethod} - the first shipping method (maybe non-PUIS)
 */
function getFirstApplicableShippingMethod(methods, filterPickupInStore) {
    var method;
    var iterator = methods.iterator();
    while (iterator.hasNext()) {
        method = iterator.next();
        if (!filterPickupInStore) {
            if (method.apiShippingMethod) {
                if (!method.apiShippingMethod.custom.storePickupEnabled) {
                    break;
                }
            } else if (!method.custom.storePickupEnabled) {
                break;
            }
        }
    }

    return method;
}

/**
 * Sets the default ShippingMethod for a Shipment, if absent
 * @param {dw.order.Shipment} shipment - the target Shipment object
 */
output.ensureShipmentHasMethod = function (shipment) {
    var shippingMethod = shipment.shippingMethod;
    if (!shippingMethod) {
        var methods = ShippingMgr.getShipmentShippingModel(shipment).applicableShippingMethods;
        var defaultMethod = ShippingMgr.getDefaultShippingMethod();
        var isAllDigitalProducts = checkoutHelper.checkDigitalProductsOnly(shipment.productLineItems);

        if (isAllDigitalProducts) {
            shippingMethod = collections.find(methods, function (method) {
                return method.ID.includes('DigitalProductShipment');
            });
        } else if (!defaultMethod) {
            // If no defaultMethod set, just use the first one
            shippingMethod = getFirstApplicableShippingMethod(methods, true);
        } else {
            // Look for defaultMethod in applicableMethods
            shippingMethod = collections.find(methods, function (method) {
                return method.ID === defaultMethod.ID;
            });
        }

        // If found, use it.  Otherwise return the first one
        if (!shippingMethod && methods && methods.length > 0) {
            shippingMethod = getFirstApplicableShippingMethod(methods, true);
        }

        if (shippingMethod) {
            shipment.setShippingMethod(shippingMethod);
        }
    }
};

/**
 * Plain JS object that represents a DW Script API dw.order.ShippingMethod object
 * @param {dw.order.Shipment} shipment - the target Shipment
 * @param {Object} [address] - optional address object
 * @returns {dw.util.Collection} an array of ShippingModels
 */
function getApplicableShippingMethods(shipment, address) {
    if (!shipment) return null;

    var shipmentShippingModel = ShippingMgr.getShipmentShippingModel(shipment);

    var shippingMethods;
    if (address) {
        shippingMethods = shipmentShippingModel.getApplicableShippingMethods(address);
    } else {
        shippingMethods = shipmentShippingModel.getApplicableShippingMethods();
    }
    // Filter out whatever the method associated with in store pickup
    var convertedMethods = checkoutHelper.convertShippingMethodsToModel(shippingMethods, shipment);

    var modifiedShippingQuotes = [];
    var checkoutPageOnly = checkoutHelper.isAllowedEndpoint();
    if (checkoutPageOnly) {
        var shippingQuotes = ShippingQuotesHelper.getShippingQuotes(shippingMethods, shipment, convertedMethods.drShippingMethod);
        shippingQuotes = ShippingQuotesHelper.applyDRFreeShipping(shippingQuotes);
        modifiedShippingQuotes = ShippingQuotesHelper.modifyShippingQuotes(shippingQuotes);
    }

    var isAllDigitalProducts = checkoutHelper.checkDigitalProductsOnly(shipment.productLineItems);

    var drEnabled = Site.getCurrent().getCustomPreferenceValue('drUseDropInFeature');

    var drShippingMethodAvailability = Site.getCurrent().getCustomPreferenceValue('drShippingMethodAvailability').value;
    if (!drEnabled || (isAllDigitalProducts && drShippingMethodAvailability === 'quotes')) {
        modifiedShippingQuotes = convertedMethods.filteredMethods;
    }

    var bothShippingMethods = convertedMethods.filteredMethods;
    if (drEnabled) {
        bothShippingMethods = convertedMethods.filteredMethods.concat(modifiedShippingQuotes);
    }

    var shippingMethodAvailability = null;
    switch (drShippingMethodAvailability) {
        case 'native':
            shippingMethodAvailability = convertedMethods.filteredMethods;
            break;
        case 'quotes':
            shippingMethodAvailability = modifiedShippingQuotes;
            break;
        case 'both':
            shippingMethodAvailability = bothShippingMethods;
            break;
        default:
            shippingMethodAvailability = convertedMethods.filteredMethods;
            break;
    }

    return shippingMethodAvailability;
}

output.getApplicableShippingMethods = getApplicableShippingMethods;

/**
 * Selects the shipping method for a given shipment
 * @param {dw.order.Shipment} shipmentArg - the target Shipment object
 * @param {string} shippingMethodID - the ID of the shipping method to be selected
 * @param {dw.util.Collection} shippingMethods - the collection of applicable shipping methods
 * @param {dw.order.Address} address - the address associated with the shipment
 * @returns {void}
 */
output.selectShippingMethod = function (shipmentArg, shippingMethodID, shippingMethods, address) {
    var shipment = shipmentArg;
    var applicableShippingMethods;
    var defaultShippingMethod = ShippingMgr.getDefaultShippingMethod();
    var shippingAddress;

    if (address && shipment) {
        shippingAddress = shipment.shippingAddress;

        if (shippingAddress) {
            if (address.stateCode && shippingAddress.stateCode !== address.stateCode) {
                shippingAddress.stateCode = address.stateCode;
            }
            if (address.postalCode && shippingAddress.postalCode !== address.postalCode) {
                shippingAddress.postalCode = address.postalCode;
            }
        }
    }

    var isShipmentSet = false;

    if (shippingMethods) {
        applicableShippingMethods = checkoutHelper.convertShippingMethodsToModel(shippingMethods, shipment).filteredMethods;
    } else {
        applicableShippingMethods = getApplicableShippingMethods(shipment, address);
    }

    applicableShippingMethods = new ArrayList(applicableShippingMethods);
    if (shippingMethodID) {
        // loop through the shipping methods to get shipping method

        var iterator = applicableShippingMethods.iterator();
        while (iterator.hasNext()) {
            var shippingMethod = iterator.next();
            if (shippingMethod.ID === shippingMethodID) {
                shipment.setShippingMethod(shippingMethod.apiShippingMethod);
                isShipmentSet = true;
                checkoutHelper.populateShipmentCustomPref(shipment, shippingMethod);
                break;
            }
        }
    }

    if (!isShipmentSet) {
        var isAllDigitalProducts = checkoutHelper.checkDigitalProductsOnly(shipment.productLineItems);
        if (isAllDigitalProducts) {
            var digitalShippingMethod = collections.find(applicableShippingMethods, function (method) {
                return method.ID.includes('DigitalProductShipment');
            });
            shipment.setShippingMethod(digitalShippingMethod.apiShippingMethod);
        } else if (collections.find(applicableShippingMethods, function (sMethod) {
            return sMethod.ID === defaultShippingMethod.ID;
        })) {
            shipment.setShippingMethod(defaultShippingMethod);
        } else if (applicableShippingMethods.length > 0) {
            var firstMethod = getFirstApplicableShippingMethod(applicableShippingMethods, true);
            shipment.setShippingMethod(firstMethod.apiShippingMethod);
            checkoutHelper.populateShipmentCustomPref(shipment, firstMethod);
        } else {
            shipment.setShippingMethod(null);
        }
    }
};

module.exports = output;
