'use strict';

var digitalRiver = require('*/cartridge/scripts/services/digitalRiver');
var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.shippingquotes');

/**
 * Makes a call to the Digital River Shipping Quotes API
 * @param {Object} body - the body of the request
 * @returns {Object} - the response from the API
 */
function shippingQuotesAPI(body) {
    var drShippingQuotes = digitalRiver.createDigitalRiverService('/shipping-quotes');
    logger.info('Sending "shipping quotes" request to {0}', drShippingQuotes.getURL());
    var result = drShippingQuotes.call(body);

    if (!result.ok) {
        logger.error('Error while getting shipping quotes: {0}', JSON.stringify(result.errorMessage));
        return result;
    }
    logger.info('Shipping Quotes {0} successfully retrieved', body);
    return result;
}

module.exports = {
    shippingQuotesAPI: shippingQuotesAPI
};
