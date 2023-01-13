var digitalRiver = require('*/cartridge/scripts/services/digitalRiver');

/**
 * Gets SKU list from to Digital River
 * @returns {dw.svc.Result} service call result
 */
function getSKUs() {
    var drSKUService = digitalRiver.createDigitalRiverService('/skus');
    return drSKUService.call();
}

/**
 * Upserts an SKU to Digital River
 * @param {string} skuId id of SKU to be created/updated
 * @param {Object} skuData data to be sent to Digital River
 * @returns {dw.svc.Result} service call result
 */
function putSKU(skuId, skuData) {
    var drSKUService = digitalRiver.createDigitalRiverService('/skus/' + skuId);
    drSKUService.setRequestMethod('PUT');
    return drSKUService.call(skuData);
}

module.exports = {
    putSKU: putSKU,
    getSKUs: getSKUs
};
