'use strict';

/**
 *  Property of OSF GLOBAL SERVICES INC. , an OSF Digital company. OSF remains the sole owner of all right, title and interest in the software. Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */

var File = require('dw/io/File');
var FileReader = require('dw/io/FileReader');
var XMLStreamReader = require('dw/io/XMLStreamReader');
var XMLStreamConstants = require('dw/io/XMLStreamConstants');
var XMLStreamWriter = require('dw/io/XMLStreamWriter');
var FileWriter = require('dw/io/FileWriter');
var Site = require('dw/system/Site');
var Status = require('dw/system/Status');
var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.dynamicpricing');
var DynamicPricingService = require('*/cartridge/scripts/services/digitalRiverDynamicPricing');
var System = require('dw/system/System');

var xsr;
var xsw;
var fileReader;
var fileWriter;
var currencies = {};
var baseCurrency;
var uniqueCurrencies;
// eslint-disable-next-line consistent-return
exports.beforeStep = function (parameters) {
    var allSites = Site.getAllSites();
    var allCurrencies = [];
    for (var i = 0; i < allSites.length; i++) {
        var currentSite = allSites[i];
        if (currentSite.getCustomPreferenceValue('drUseDropInFeature') && currentSite.getCustomPreferenceValue('drEnableDynamicPricing')) {
            var currentPairs = currentSite.getCustomPreferenceValue('drCountryCurrencyPairs') ? JSON.parse(currentSite.getCustomPreferenceValue('drCountryCurrencyPairs')) : null;
            baseCurrency = System.getPreferences().getCustom().drBaseCurrencyCode;

            if (!baseCurrency) {
                logger.error('Base currency is not defined');
                throw new Error('Base currency is not defined');
            }

            if (currentPairs && Object.keys(currentPairs).length > 0) {
                for (var countryCode in currentPairs) { //eslint-disable-line
                    var currencyCodes = currentPairs[countryCode];
                    for (var currencyCode of currencyCodes) {
                        allCurrencies.push(currencyCode);
                        if (!currencies[currencyCode]) {
                            var result = DynamicPricingService.convertDynamicPricing({
                                countryCode: countryCode,
                                currencyCode: currencyCode,
                                prices: []
                            });
                            if (result.status === 'OK' && result.object.operatedByDr === true) {
                                currencies[currencyCode] = countryCode;
                            }
                        }
                    }
                }
                // Check if there are currencies that do not have a country code
                // If there are, then assign the first country code that has that currency
                // This is to handle if there are not any countries that are supported by DR that are supported by the site
                var uniqueCurrencyList = Array.from(new Set(allCurrencies)); //eslint-disable-line
                for (var currencyCode2 of uniqueCurrencyList) {
                    if (!currencies[currencyCode2]) {
                        for (var countryCode2 in currentPairs) { //eslint-disable-line
                            if (currentPairs[countryCode2].includes(currencyCode2)) {
                                currencies[currencyCode2] = countryCode2;
                                break;
                            }
                        }
                    }
                }
            }
            if (Object.keys(currencies).length === 0) {
                logger.error('No currencies are configured for dynamic pricing');
                throw new Error('No currencies are configured for dynamic pricing');
            }
        }
    }

    uniqueCurrencies = Object.keys(currencies);
    if (!uniqueCurrencies.includes(baseCurrency)) {
        logger.error('Base currency is not configured for Dynamic Pricing. Please add a pair from the BM Module that includes the base currency');
        throw new Error('Base currency is not configured for Dynamic Pricing. Please add a pair from the BM Module that includes the base currency');
    }

    if (!parameters.BaseCatalogPath) {
        logger.error('Base catalog path is not defined');
        throw new Error('Base catalog path is not defined');
    }
    if (!parameters.ExportFolderPath) {
        logger.error('Export folder path is not defined');
        throw new Error('Export folder path is not defined');
    }
    if (!baseCurrency) {
        logger.error('Base currency is not defined');
        throw new Error('Base currency is not defined');
    }

    var readfile = new File(File.IMPEX + File.SEPARATOR + 'src' + File.SEPARATOR + parameters.BaseCatalogPath + '.xml');
    if (!readfile.exists()) {
        logger.error('Base catalog file does not exist');
        throw new Error('Base catalog file does not exist');
    }

    fileReader = new FileReader(readfile);
    xsr = new XMLStreamReader(fileReader);
    var catalogID;
    while (xsr.hasNext()) {
        var eventType = xsr.next();
        if (eventType === XMLStreamConstants.START_ELEMENT) {
            if (xsr.getLocalName() === 'catalog' && xsr.getAttributeValue(null, 'catalog-id')) {
                catalogID = xsr.getAttributeValue(null, 'catalog-id');
                break;
            }
        }
    }
    var exportFolderFile = new File(File.IMPEX + File.SEPARATOR + 'src' + File.SEPARATOR + parameters.ExportFolderPath);
    if (!exportFolderFile.exists()) {
        exportFolderFile.mkdirs();
    }
    var writeFile = new File(exportFolderFile.fullPath + File.SEPARATOR + 'drConvertedProductOptions(' + catalogID + ').xml');
    fileWriter = new FileWriter(writeFile);
    xsw = new XMLStreamWriter(fileWriter);
    xsw.writeStartDocument();
    xsw.writeRaw('<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="' + catalogID + '">');
};

// eslint-disable-next-line consistent-return
exports.read = function () {
    var option = {};
    var value = {};
    while (xsr.hasNext()) {
        var eventType = xsr.next();
        try {
            if (eventType === XMLStreamConstants.START_ELEMENT) {
                if (xsr.getLocalName() === 'product-option') {
                    option = { id: xsr.getAttributeValue(null, 'option-id'), values: [], defaultArray: [] };
                }
                if (xsr.getLocalName() === 'option-value' && xsr.getAttributeValue(null, 'value-id') && option.id) {
                    value = { id: xsr.getAttributeValue(null, 'value-id'), displayValues: [] };
                    option.defaultArray.push(xsr.getAttributeValue(null, 'default'));
                }
                if (xsr.getLocalName() === 'display-value') {
                    value.displayValues.push({ lang: xsr.getAttributeValue('http://www.w3.org/XML/1998/namespace', 'lang'), value: xsr.readXMLObject().toString() });
                }
                if (xsr.getLocalName() === 'option-value-price' && xsr.getAttributeValue(null, 'currency') === baseCurrency && value.id) {
                    value.price = xsr.readXMLObject().toString();
                    option.values.push(value);
                }
            }
        } catch (error) {
            option.error = true;
        }

        if (eventType === XMLStreamConstants.END_ELEMENT && xsr.getLocalName() === 'product-option') {
            return option;
        }
    }
};

/**
 * Converts product options to a new format
 * @param {Object} option - the option object
 * @param {Array} object - the array of product objects
 * @param {Object} newValuesArgs - the new values object
 * @param {string} currencyCode - the currency code
 * @param {string} priceAttributeName - the price attribute name
 * @returns {Object} - the converted product options
 */
function getConvertedProductOptions(option, object, newValuesArgs, currencyCode, priceAttributeName) {
    var newValues = newValuesArgs;
    for (let j = 0; j < object.length; j++) {
        var convertedProduct = object[j];
        if (currencyCode && convertedProduct[priceAttributeName]) {
            if (!Object.hasOwnProperty.call(newValues, convertedProduct.id)) {
                newValues[convertedProduct.id] = { prices: {} };
                newValues[convertedProduct.id].prices[currencyCode] = convertedProduct[priceAttributeName];
                newValues[convertedProduct.id].default = option.defaultArray[j];
                newValues[convertedProduct.id].displayValues = option.values[j].displayValues;
            } else {
                newValues[convertedProduct.id].prices[currencyCode] = convertedProduct[priceAttributeName];
                newValues[convertedProduct.id].default = option.defaultArray[j];
                newValues[convertedProduct.id].displayValues = option.values[j].displayValues;
            }
        }
    }
    return newValues;
}

exports.process = function (option) {
    var options = {};
    var result;
    var newValues = {};
    if (option && !option.error && uniqueCurrencies.length > 0) {
        try {
            for (var i = 0; i < uniqueCurrencies.length; i++) {
                var currencyCode = uniqueCurrencies[i];
                if (currencyCode !== baseCurrency) {
                    // convert the price for each currency (except the base currency)
                    if (Object.hasOwnProperty.call(currencies, currencyCode)) {
                        logger.info('Currency ' + currencyCode + ' is for the ' + currencies[currencyCode] + ' country');
                        result = DynamicPricingService.convertDynamicPricing({
                            countryCode: currencies[currencyCode],
                            currencyCode: currencyCode,
                            prices: option.values
                        });

                        if (result.status === 'OK') {
                            newValues = getConvertedProductOptions(option, result.object.prices, newValues, currencyCode, 'calculatedPrice');
                        }
                    }
                } else {
                    newValues = getConvertedProductOptions(option, option.values, newValues, currencyCode, 'price');
                }
            }
        } catch (error) {
            logger.error('Error while processing product option: ' + error);
            logger.error('Product option: ' + option.id + ' will be skipped');
            options.error = true;
        }

        options[option.id] = newValues;
    } else {
        logger.error('Product option is not found');
    }
    return options;
};

exports.write = function (optionArray) {
    if (optionArray.length > 0) {
        if (Object.keys(optionArray[0]).length > 0) {
            for (let i = 0; i < optionArray.length; i++) {
                if (!optionArray[i].error) {
                    var element = '';
                    try {
                        for (var [optionID, optionValue] of Object.entries(optionArray[i])) {
                            element += '<product-option option-id="' + optionID + '"><option-values>';
                            for (var [valueID, value] of Object.entries(optionValue)) {
                                element += '<option-value value-id="' + valueID + '" default="' + value.default + '">';
                                for (let j = 0; j < value.displayValues.length; j++) {
                                    element += '<display-value xml:lang="' + value.displayValues[j].lang + '">' + value.displayValues[j].value + '</display-value>';
                                }
                                element += '<option-value-prices>';
                                for (var [currency, price] of Object.entries(value.prices)) {
                                    element += '<option-value-price currency="' + currency + '">' + price + '</option-value-price>';
                                }
                                element += '</option-value-prices></option-value>';
                            }
                            element += '</option-values></product-option>';
                        }
                    } catch (error) {
                        logger.error('Error while writing product option: ' + error);
                        element = '';
                    }
                    if (element.length > 0) {
                        xsw.writeRaw(element);
                    }
                }
            }
        } else {
            logger.error('Product options are not found');
        }
    } else {
        logger.error('Product options are not found');
    }
};

exports.afterStep = function (success) {
    if (!success) {
        return new Status(Status.ERROR);
    }

    xsw.writeRaw('</catalog>');
    xsw.writeEndDocument();
    xsr.close();
    fileReader.close();
    xsw.close();
    fileWriter.close();
    logger.info('Product options are converted with Dynamic Pricing and exported successfully');
    return new Status(Status.OK);
};

