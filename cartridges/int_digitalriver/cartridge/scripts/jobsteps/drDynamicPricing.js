'use strict';

/**
 *  Property of OSF GLOBAL SERVICES INC. , an OSF Digital company. OSF remains the sole owner of all right, title and interest in the software. Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */

var Status = require('dw/system/Status');
var Site = require('dw/system/Site');
var DynamicPricingHelper = require('*/cartridge/scripts/digitalRiver/drDynamicPricingHelper');
var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.dynamicpricing');

var currencies = [];
// eslint-disable-next-line consistent-return
exports.beforeStep = function (parameters) {
    var currentSite = Site.getCurrent();
    var drCountryCurrencyPairs = currentSite.getCustomPreferenceValue('drCountryCurrencyPairs') ? JSON.parse(currentSite.getCustomPreferenceValue('drCountryCurrencyPairs')) : null;
    if (!currentSite.getCustomPreferenceValue('drUseDropInFeature')) {
        logger.error('Digital River cartridge is not enabled');
        throw new Error('Digital River cartridge is not enabled');
    }
    if (!currentSite.getCustomPreferenceValue('drEnableDynamicPricing')) {
        logger.error('Dynamic pricing is not enabled');
        throw new Error('Dynamic pricing is not enabled');
    }
    if (!drCountryCurrencyPairs) {
        logger.error('Country currency pairs are not defined');
        throw new Error('Country currency pairs are not defined');
    }
    if (!parameters.BaseListPriceBookPath) {
        logger.error('Base list price book path is not defined');
        throw new Error('Base list price book path is not defined');
    }
    if (!parameters.BaseSalePriceBookPath) {
        logger.error('Base sale price book path is not defined');
        throw new Error('Base sale price book path is not defined');
    }
    if (!parameters.DynamicPricingExportFolder) {
        logger.error('Dynamic pricing export folder is not defined');
        throw new Error('Dynamic pricing export folder is not defined');
    }
    var isCountryCodeSelected = parameters.CountryCode && drCountryCurrencyPairs && drCountryCurrencyPairs[parameters.CountryCode] && Array.isArray(drCountryCurrencyPairs[parameters.CountryCode]);
    if (isCountryCodeSelected) {
        currencies = drCountryCurrencyPairs[parameters.CountryCode];
    } else if (drCountryCurrencyPairs && !parameters.CountryCode) {
            for (var country in drCountryCurrencyPairs) { //eslint-disable-line
            var currency = drCountryCurrencyPairs[country];
            for (let i = 0; i < currency.length; i += 1) {
                currencies.push([country, currency[i]]);
            }
        }
    }
};

// eslint-disable-next-line consistent-return
exports.read = function () {
    if (currencies.length > 0) {
        var currentCurrency = currencies.pop();
        if (!empty(currentCurrency)) {
            return currentCurrency;
        }
    }
    return null;
};

// eslint-disable-next-line consistent-return
exports.process = function (currency, parameters) {
    if (!empty(currency)) {
        var currentSite = Site.getCurrent();
        var currentCountry = parameters.CountryCode ? parameters.CountryCode : currency[0];
        var currentCurrency = parameters.CountryCode ? currency : currency[1];
        try {
            if (parameters.BaseListPriceBookPath) {
                logger.info('Exporting dynamic pricing for country {0} and currency {1} for list price book', currentCountry, currentCurrency);
                try {
                    DynamicPricingHelper.getDynamicPricing(parameters.BaseListPriceBookPath, parameters.DynamicPricingExportFolder, currentCountry, currentCurrency, currentSite.getCustomPreferenceValue('drListConvertedPriceBookNaming'));
                } catch (error) {
                    logger.error('Error while exporting dynamic pricing for country {0} and currency {1} with error {2}', currentCountry, currentCurrency, error.toString());
                }
            }
            if (parameters.BaseSalePriceBookPath) {
                logger.info('Exporting dynamic pricing for country {0} and currency {1} for sale price book', currentCountry, currentCurrency);
                try {
                    DynamicPricingHelper.getDynamicPricing(parameters.BaseSalePriceBookPath, parameters.DynamicPricingExportFolder, currentCountry, currentCurrency, currentSite.getCustomPreferenceValue('drSaleConvertedPriceBookNaming'), currentSite.getCustomPreferenceValue('drListConvertedPriceBookNaming'));
                } catch (error) {
                    logger.error('Error while exporting dynamic pricing for country {0} and currency {1} with error {2}', currentCountry, currentCurrency, error.toString());
                }
            }
        } catch (error) {
            logger.error('Error while exporting dynamic pricing for country {0} and currency {1} with error {2}', currentCountry, currentCurrency, error.toString());
        }
    }
};

exports.write = function () {};

exports.afterStep = function (success) {
    if (!success) {
        return new Status(Status.ERROR);
    }

    logger.info('Dynamic pricing export completed successfully');
    return new Status(Status.OK);
};
