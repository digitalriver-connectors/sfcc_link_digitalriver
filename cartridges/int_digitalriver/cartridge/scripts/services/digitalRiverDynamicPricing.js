'use strict';

var digitalRiver = require('*/cartridge/scripts/services/digitalRiver');
var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.dynamicpricing');

var batchNo = 1;
var countryCode;
/**
 * Converts dynamic pricing for a given country and currency
 * @param {Object} body - request body containing country and currency
 * @returns {Object} - response object containing converted prices
 */
function convertDynamicPricing(body) {
    var drDynamicPricing = digitalRiver.createDigitalRiverService('/dynamic-pricing/conversions');
    logger.debug('Sending "dynamic pricing conversion" request to {0}', drDynamicPricing.getURL());
    var result = drDynamicPricing.call(body);

    if (!result.ok) {
        logger.error('Error while converting dynamic price: {0}', JSON.stringify(result.errorMessage));
        return result;
    }
    if (!countryCode || countryCode !== body.countryCode) {
        batchNo = 1;
        countryCode = body.countryCode;
    }

    logger.debug('Dynamic prices for country {0} and currency {1} successfully converted (Batch {2})', body.countryCode, body.currencyCode, batchNo);
    batchNo += 1;
    return result;
}

module.exports = {
    convertDynamicPricing: convertDynamicPricing
};
