'use strict';

var parent = module.superModule;

var ShippingMethodModel = require('*/cartridge/models/shipping/shippingMethod');
var BasketMgr = require('dw/order/BasketMgr');

/**
 * Plain JS object that represents a DW Script API dw.order.ShippingMethod object
 * @param {dw.order.Shipment} shipment - the target Shipment
 * @returns {Object} a ShippingMethodModel object
 */
function getSelectedShippingMethod(shipment) {
    if (!shipment) return null;

    var method = shipment.shippingMethod;

    // Digital River Modification - Begin
    var model = null;
    if (method) {
        model = new ShippingMethodModel(method, shipment);
        if (method.ID.indexOf('DRDefaultShp') > -1) {
            var sqModel = {};
            sqModel.default = false;
            sqModel.description = shipment.custom.drSQDescription;
            sqModel.displayName = shipment.custom.drSQServiceLevel;
            sqModel.shippingTerms = shipment.custom.drSQShippingTerms;
            sqModel.estimatedArrivalTime = shipment.custom.drSQEstimatedArrivalTime;
            sqModel.ID = shipment.custom.drUniqueID;
            sqModel.selected = true;
            sqModel.shippingCost = shipment.custom.drSQTotalAmount;
            model = sqModel;
        }
    }

    // Digital River Modification - End

    return model;
}

/**
 * @constructor
 * @classdesc Model that represents shipping information
 *
 * @param {dw.order.Shipment} shipment - the default shipment of the current basket
 * @param {Object} address - the address to use to filter the shipping method list
 * @param {Object} customer - the current customer model
 * @param {string} containerView - the view of the product line items (order or basket)
 */
function ShippingModel(shipment, address) {
    parent.apply(this, arguments);
    var shippingHelpers = require('*/cartridge/scripts/checkout/shippingHelpers');
    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    var Transaction = require('dw/system/Transaction');

    //this.applicableShippingMethods = shippingHelpers.getApplicableShippingMethods(shipment, address);
    if (!this.applicableShippingMethods || empty(this.applicableShippingMethods)) {
        var basket = BasketMgr.getCurrentBasket();
        if (basket) {
            Transaction.wrap(function () {
                shipment.setShippingMethod(null);
                basketCalculationHelpers.calculateTotals(basket);
            });
        }
    }
    this.selectedShippingMethod = getSelectedShippingMethod(shipment);
}

module.exports = ShippingModel;
