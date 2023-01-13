/* globals request */
'use strict';

/**
 * creates tax identifier in Digital River's systems
 *
 * @param {Object} body - tax identifier body
 * @returns {Object} Digital River response object
 */
function createTaxIdentifier(body) {
    var digitalRiver = require('*/cartridge/scripts/services/digitalRiver');
    var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.taxidentifier');

    var taxidentifierSvc = digitalRiver.createDigitalRiverService('/tax-identifiers');
    taxidentifierSvc.setRequestMethod('POST');
    logger.info('Sending "create tax identifier" request to {0}', taxidentifierSvc.getURL());

    var result = taxidentifierSvc.call(body);
    if (result.ok) {
        logger.info('tax identifier created {0}', result.object.id);
    } else {
        logger.error('Error while creating tax identifier: {0}', JSON.stringify(result.errorMessage));
    }
    return result;
}

/**
 * delete tax identifier from DR side
 * @param {string} identifierId - id of identifier
 * @returns {Object} service response
 */
function deleteTaxIdentifier(identifierId) {
    var digitalRiver = require('*/cartridge/scripts/services/digitalRiver');
    var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.taxidentifier');

    var taxidentifierSvc = digitalRiver.createDigitalRiverService('/tax-identifiers/' + identifierId);
    taxidentifierSvc.setRequestMethod('DELETE');
    logger.info('Sending "delete tax identifier" request to {0}', taxidentifierSvc.getURL());

    var result = taxidentifierSvc.call();
    if (result.ok) {
        logger.info('tax identifier deleted {0}', identifierId);
    } else {
        logger.error('Error while deleting tax identifier: {0}', JSON.stringify(result.errorMessage));
    }
    return result;
}

module.exports = {
    createTaxIdentifier: createTaxIdentifier,
    deleteTaxIdentifier: deleteTaxIdentifier
};
