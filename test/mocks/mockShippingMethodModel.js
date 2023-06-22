'use strict';

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

module.exports = {
    getSelectedShippingMethod: getSelectedShippingMethod
};
