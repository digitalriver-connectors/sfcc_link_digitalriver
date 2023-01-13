'use strict';

/**
 * get list of applyed tax identifiers from DR side
 * @param {Object} basket - basket
 * @returns {Array} list of identifiers from Basket custom attribute
 */
function getAppliedTaxIdentifiers(basket) {
    var appliedTaxIdentifiers = [];
    var currentBasket = basket;
    if (!basket) {
        currentBasket = require('dw/order/BasketMgr').getCurrentBasket();
    }
    if (!empty(currentBasket.custom.drTaxIdentifiers) && currentBasket.custom.drTaxIdentifiers !== 'undefined') {
        appliedTaxIdentifiers = JSON.parse(currentBasket.custom.drTaxIdentifiers);
    }
    return appliedTaxIdentifiers;
}

/**
 * create tax identifiers on DR side
 * @param {Object} identifiers - list of identifiers in object format
 * @returns {Object} helper response
 */
function createTaxIdentifiers(identifiers) {
    var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.taxidentifier');
    var taxidentifierSvc = require('*/cartridge/scripts/services/digitalRiverTaxIdentifier');
    var checkoutSvc = require('*/cartridge/scripts/services/digitalRiverCheckout');
    var helperResponse = {
        error: false,
        errorMessage: ''
    };
    var idsOfSuccessfulIdentifiers = [];
    var customerType = '';

    try {
        Object.keys(identifiers).forEach(function (key) {
            var errorMessage = '';
            // get identifier from FE
            var identifier = identifiers[key];
            if (identifier.type && identifier.value) {
                // prepare identifier body for service
                var svcBody = {
                    type: identifier.type,
                    value: identifier.value
                };
                // send identifier to DR
                var taxidentifierSvcResult = taxidentifierSvc.createTaxIdentifier(svcBody);
                if (taxidentifierSvcResult.ok && taxidentifierSvcResult.object && taxidentifierSvcResult.object.id) {
                    // if identifier is created on DR, add to the list to attach to checkout
                    idsOfSuccessfulIdentifiers.push({
                        id: taxidentifierSvcResult.object.id
                    });
                    customerType = identifier.customerType;
                } else {
                    // else return error
                    errorMessage = 'Identifier not created: ' + JSON.stringify(taxidentifierSvcResult);
                    logger.error(errorMessage);
                    throw errorMessage;
                }
            } else {
                errorMessage = 'Incorrect identifier object: ' + JSON.stringify(identifier);
                logger.error(errorMessage);
                throw errorMessage;
            }
        });
    } catch (error) {
        helperResponse.error = true;
        helperResponse.errorMessage = error;
    }

    if (!helperResponse.error) {
        // attach successful identifiers to checkout
        try {
            var errorMessage = '';
            var currentBasket = require('dw/order/BasketMgr').getCurrentBasket();
            if (currentBasket && currentBasket.custom.drCheckoutID) {
                // In the case that the customer does not apply any tax identifiers to the checkout,
                // the tax identifier array should explicitly be set to empty and should not be left null or excluded

                // Add already applyed tax identifiers from basket
                var appliedTaxIdentifiers = getAppliedTaxIdentifiers(currentBasket);
                appliedTaxIdentifiers.forEach(function (identifier) {
                    idsOfSuccessfulIdentifiers.push({
                        id: identifier.id
                    });
                });
                // construct service body
                var bodyForCheckoutSvc = {
                    taxIdentifiers: idsOfSuccessfulIdentifiers
                };
                if (customerType !== '') {
                    bodyForCheckoutSvc.customerType = customerType;
                }
                // update checkout on DR
                var checkoutSvcResult = checkoutSvc.updateCheckout(currentBasket.custom.drCheckoutID, bodyForCheckoutSvc);
                if (checkoutSvcResult.ok) {
                    if (checkoutSvcResult.object && checkoutSvcResult.object.taxIdentifiers) {
                        // get applied tax identifiers from DR checkout
                        helperResponse.appliedTaxIdentifiers = checkoutSvcResult.object.taxIdentifiers;
                        // update DR checkout values in basket
                        var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
                        drTaxHelper.saveCheckoutDataToBasket(checkoutSvcResult.object, currentBasket);
                    }
                } else {
                    errorMessage = 'Service error - can not update checkout: ' + JSON.stringify(checkoutSvcResult);
                    logger.error(errorMessage);
                    throw errorMessage;
                }
            } else {
                errorMessage = 'Basket or checkout id is missing';
                logger.error(errorMessage);
                throw errorMessage;
            }
        } catch (error) {
            helperResponse.error = true;
            helperResponse.errorMessage = error;
        }
    }

    return helperResponse;
}

/**
 * Delete identifier from DR checkout
 * @param {string} idOfIdentifierToDelete - id of identifier
 * @param {boolean} notUpdateCheckout - when deleting more than one identifier we will update checkout only once
 * @returns {Object} response from helper
 */
function deleteIdentifier(idOfIdentifierToDelete, notUpdateCheckout) {
    var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.taxidentifier');
    var taxidentifierSvc = require('*/cartridge/scripts/services/digitalRiverTaxIdentifier');
    var helperResponse = {
        error: false,
        errorMessage: ''
    };
    try {
        var errorMessage = '';
        var taxidentifierSvcResult = taxidentifierSvc.deleteTaxIdentifier(idOfIdentifierToDelete);
        // if identifier was deleted successfully
        if (taxidentifierSvcResult.ok) {
            if (!notUpdateCheckout) {
                var currentBasket = require('dw/order/BasketMgr').getCurrentBasket();
                var checkoutSvc = require('*/cartridge/scripts/services/digitalRiverCheckout');
                if (currentBasket && currentBasket.custom.drCheckoutID) {
                    var checkoutId = currentBasket.custom.drCheckoutID;
                    // get tax identifiers from basket
                    var appliedTaxIdentifiers = getAppliedTaxIdentifiers(currentBasket);
                    // prepare a list for checkout update
                    var identifiersForCheckoutUpdate = [];
                    Object.keys(appliedTaxIdentifiers).forEach(function (key) {
                        var identifier = appliedTaxIdentifiers[key];
                        if (identifier.id !== idOfIdentifierToDelete) {
                            identifiersForCheckoutUpdate.push({
                                id: identifier.id
                            });
                        }
                    });
                    // body for checkout update
                    var bodyForCheckoutSvc = {
                        taxIdentifiers: identifiersForCheckoutUpdate
                    };
                    // send updated list of identifiers to DR
                    var checkoutSvcResult = checkoutSvc.updateCheckout(checkoutId, bodyForCheckoutSvc);
                    if (checkoutSvcResult.ok) {
                        // save updated checkout to basket
                        if (checkoutSvcResult.object) {
                            var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
                            drTaxHelper.saveCheckoutDataToBasket(checkoutSvcResult.object, currentBasket);
                        }
                    }
                } else {
                    errorMessage = 'Basket or checkout id is missing';
                    logger.error(errorMessage);
                    throw errorMessage;
                }
            }
        } else {
            errorMessage = 'Service error - deleting identifier: ' + JSON.stringify(taxidentifierSvcResult);
            logger.error(errorMessage);
            throw errorMessage;
        }
    } catch (error) {
        helperResponse.error = true;
        helperResponse.errorMessage = error;
    }
    return helperResponse;
}

/**
 * delete all identifiers from DR checkout
 * @param {Array} identifiers - list of identifiers
 * @returns {Object} response from helper
 */
function deleteAllIdentifiers(identifiers) {
    var helperResponse = {
        error: false,
        errorMessage: ''
    };
    try {
        Object.keys(identifiers).forEach(function (key) {
            var identifier = identifiers[key];
            deleteIdentifier(identifier.id, true);
        });
        var currentBasket = require('dw/order/BasketMgr').getCurrentBasket();
        var checkoutSvc = require('*/cartridge/scripts/services/digitalRiverCheckout');
        if (currentBasket && currentBasket.custom.drCheckoutID) {
            var checkoutId = currentBasket.custom.drCheckoutID;
            // body for checkout update
            var bodyForCheckoutSvc = {
                taxIdentifiers: []
            };
            // send updated list of identifiers to DR
            var checkoutSvcResult = checkoutSvc.updateCheckout(checkoutId, bodyForCheckoutSvc);
            if (checkoutSvcResult.ok) {
                // save updated checkout to basket
                if (checkoutSvcResult.object) {
                    var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
                    drTaxHelper.saveCheckoutDataToBasket(checkoutSvcResult.object, currentBasket);
                }
            }
        } else {
            var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.taxidentifier');
            var errorMessage = 'Basket or checkout id is missing';
            logger.error(errorMessage);
            throw errorMessage;
        }
    } catch (error) {
        helperResponse.error = true;
        helperResponse.errorMessage = error;
    }
    return helperResponse;
}

module.exports = {
    createTaxIdentifiers: createTaxIdentifiers,
    getAppliedTaxIdentifiers: getAppliedTaxIdentifiers,
    deleteIdentifier: deleteIdentifier,
    deleteAllIdentifiers: deleteAllIdentifiers
};
