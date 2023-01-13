'use strict';

var Status = require('dw/system/Status');
var Site = require('dw/system/Site');
var ProductMgr = require('dw/catalog/ProductMgr');
var Transaction = require('dw/system/Transaction');
var logger = require('dw/system').Logger.getLogger('DigitalRiver', '');

var maxNumberOfLoggedErrors = 100;
var numberOfPublishedErrors;
request.custom.isJobRequest = true;

/**
 * Check product dates and returns true if the product is modified
 *
 * @param {Object} product - Product Object
 * @returns {boolean} true if product is modified since drExportedDate
 */
function isProductModified(product) {
    var productLastModifiedDate = product.lastModified;
    var drExportedDate = product.custom.drExportedDate;
    if (!drExportedDate) {
        return true;
    }
    var diffBetweenDates = productLastModifiedDate.getTime() - (drExportedDate ? drExportedDate.getTime() : 0);

    return diffBetweenDates > 0;
}

/**
 * Send product data and return the status of the operation
 *
 * @param {Object} product - Product Object
 * @returns {Object} status object
 */
function sendProductData(product) {
    var drSkuAPI = require('*/cartridge/scripts/services/digitalRiverSKU');
    var status = new Status(Status.OK);
    var body = {
        eccn: product.custom.drECCN.value,
        countryOfOrigin: product.custom.drCountryOfOrigin,
        taxCode: product.taxClassID,
        name: product.name
    };

    var additionalAttributes = {
        partNumber: product.custom.drPartNumber,
        hsCode: product.custom.drHsCode,
        weight: product.custom.drWeight ? Number(product.custom.drWeight.toFixed(4)) : null,
        weightUnit: product.custom.drWeight ? (product.custom.drWeightUnit.value || 'oz') : null,
        managedFulfillment: product.custom.drManagedFulfillment.value,
        manufacturerId: product.custom.drManufacturerId,
        skuGroupId: product.custom.drSkuGroupId
    };

    Object.keys(additionalAttributes).forEach(function (key) {
        if (!empty(additionalAttributes[key])) {
            body[key] = additionalAttributes[key];
        }
    });

    var serviceResponse = drSkuAPI.putSKU(product.ID, body);
    if (serviceResponse.ok) {
        try {
            Transaction.wrap(function () {
                var sentProduct = product;
                sentProduct.custom.drExportedDate = new Date();
            });
        } catch (e) {
            logger.error(e.message);
            status = new Status(Status.ERROR);
        }
    } else {
        ++numberOfPublishedErrors;
        if (numberOfPublishedErrors <= maxNumberOfLoggedErrors) {
            logger.info('Error sending product "{0}" data: {1}', product.ID, serviceResponse.errorMessage);
        }
    }

    return status;
}

/**
 * Checks if product is digital or not
 *
 * @param {Object} product - Product Object
 * @returns {boolen} result of the check
 */
function isDigitalProductTaxCode(product) {
    var drDigitalTaxCodesProperty = 'drDigitalProductTaxCodes';
    var drDigitalTaxCodes = Site.getCurrent().getCustomPreferenceValue(drDigitalTaxCodesProperty);
    var productTaxClassID = product.getTaxClassID();

    if (drDigitalTaxCodes.length === 0) {
        logger.warn('No digital tax codes were found. Check BM preferences.');
    }

    var isDigitalProduct = drDigitalTaxCodes.includes(productTaxClassID);

    return isDigitalProduct;
}

/**
 * Updates drDigitalProduct property
 *
 * @param {Object} product - Product Object
 * @returns {boolean} result of update
 */
function updateDigitalProductProperty(product) {
    var isUpdated = true;
    var isDigitalProduct = isDigitalProductTaxCode(product);

    try {
        var sentProduct = product;
        var isChangedProductProperty = sentProduct.custom.drDigitalProduct !== isDigitalProduct;

        if (isChangedProductProperty) {
            Transaction.wrap(function () {
                sentProduct.custom.drDigitalProduct = isDigitalProduct;
            });
        }
    } catch (e) {
        logger.error('Error updating product with ID: "{0}", error message: {1}', product.ID, e.message);
        return !isUpdated;
    }

    return isUpdated;
}

/**
 * Run the process to check and send products
 *
 * @param {boolean} onlyModified - indicate to send only modified products
 * @returns {Object} a status object
 */
var runSending = function (onlyModified) {
    var status = new Status(Status.OK);
    var products = ProductMgr.queryAllSiteProducts();

    numberOfPublishedErrors = 0;

    while (products.hasNext()) {
        var product = products.next();
        var sendProduct = true;
        var isUpdatedProduct = updateDigitalProductProperty(product);

        if (!isUpdatedProduct) {
            status = new Status(Status.ERROR);
            break;
        }

        // send to DigitalRiver only the products with the non-empty required attributes
        sendProduct = product.custom.drECCN && !empty(product.custom.drECCN.value);
        sendProduct = sendProduct && !empty(product.custom.drCountryOfOrigin) && !empty(product.name);

        // Check the taxClassID before sending the product,
        // if taxClass is ‘standard’ or empty(undefined) do not send such products.
        sendProduct = sendProduct
          && !empty(product.getTaxClassID())
          && product.getTaxClassID().toLowerCase() !== 'standard';

        if (sendProduct) {
            if (onlyModified) { // run job to send only updated products
                if (isProductModified(product)) {
                    sendProductData(product);
                }
            } else {    // run job to send all products
                sendProductData(product);
            }
        }
    }
    products.close();

    if (numberOfPublishedErrors) {
        logger.info('First {0} errors were logged. Total errors sending product data {1}', maxNumberOfLoggedErrors, numberOfPublishedErrors);
        status = new Status(Status.ERROR);
    }

    return status;
};

/**
 * Run the custom.deltaSkuUpdate job step for modified products
 *
 * @returns {Object} a status object
 */
var deltaSkuUpdate = function () {
    var status = runSending(true);
    return status;
};

/**
 * Run the custom.deltaSkuUpdateOnButton job step for modified products
 *
 * @returns {Object} a status object
 */
var deltaSkuUpdateOnButton = function () {
    var startDeltaJobProperty = 'drStartDeltaJob';

    var startJob = Site.getCurrent().getCustomPreferenceValue(startDeltaJobProperty);
    if (!startJob) {
        return new Status(Status.OK);
    }

    var jobStatus = deltaSkuUpdate();

    Transaction.wrap(function () {
        Site.getCurrent().setCustomPreferenceValue(startDeltaJobProperty, false);
    });

    return jobStatus;
};

/**
 * Run the custom.fullSkuUpdate job step for all products
 *
 * @returns {Object} a status object
 */
var fullSkuUpdate = function () {
    var jobStatus = runSending(false);
    return jobStatus;
};

/**
 * Run the custom.fullSkuUpdateOnButton job step for all products
 *
 * @returns {Object} a status object
 */
var fullSkuUpdateOnButton = function () {
    var startSendingAllSkusJobProperty = 'drStartAllSkusJob';

    var startJob = Site.getCurrent().getCustomPreferenceValue(startSendingAllSkusJobProperty);
    if (!startJob) {
        return new Status(Status.OK);
    }

    var jobStatus = fullSkuUpdate();

    Transaction.wrap(function () {
        Site.getCurrent().setCustomPreferenceValue(startSendingAllSkusJobProperty, false);
    });

    return jobStatus;
};

module.exports = {
    deltaSkuUpdate: deltaSkuUpdate,
    deltaSkuUpdateOnButton: deltaSkuUpdateOnButton,
    fullSkuUpdate: fullSkuUpdate,
    fullSkuUpdateOnButton: fullSkuUpdateOnButton
};
