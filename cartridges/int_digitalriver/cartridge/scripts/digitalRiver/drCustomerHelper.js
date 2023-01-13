'use strict';

/**
 * checks if customer is created on DR side otherwise makes a request to create new customer
 * @param {dw.customer.Profile} profile - customer profile
 * @returns {Object} object with DR customer response or error message
 */
function checkDrCustomer(profile) {
    var Transaction = require('dw/system/Transaction');
    var Resource = require('dw/web/Resource');
    var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
    var drCustomerId = profile.custom.globalCommerceCustID;
    var drResponse;

    if (drCustomerId) {
        drResponse = drCustomerAPI.getCustomerById(drCustomerId);
        if (drResponse) {
            return { drCustomer: drResponse };
        }
    }

    drResponse = drCustomerAPI.createCustomer(profile.email, profile.customerNo);

    if (drResponse.ok) {
        Transaction.wrap(function () {
            profile.custom.globalCommerceCustID = drResponse.object.id; // eslint-disable-line no-param-reassign
        });

        return { drCustomer: drResponse.object };
    }

    if (drResponse.error === 409) {
        var errorData = JSON.parse(drResponse.errorMessage);
        if (errorData.errors[0].code === 'already_exists') {
            drResponse = drCustomerAPI.getCustomerById(profile.customerNo);
            if (drResponse) {
                Transaction.wrap(function () {
                    profile.custom.globalCommerceCustID = drResponse.id; // eslint-disable-line no-param-reassign
                });

                return { drCustomer: drResponse };
            }
        }
    }

    return { drCustomerError: Resource.msg('error.drCustomer', 'digitalriver', null) };
}

module.exports = {
    checkDrCustomer: checkDrCustomer
};
