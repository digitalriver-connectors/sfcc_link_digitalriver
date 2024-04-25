'use strict';

var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');
var URLUtils = require('dw/web/URLUtils');
var Site = require('dw/system/Site');
var ISML = require('dw/template/ISML');

var JOBTYPES = {
    onlyModifiedProducts: 'drStartDeltaJob',
    allProducts: 'drStartAllSkusJob'
};

/**
 * Shows Digital River Service tester bm page
 */
function Start() {
    ISML.renderTemplate('digitalriverbm/digitalriver');
}

/**
 * Sends test requests to API endpoints and returns the status
 */
function TestServices() {
    var resp = {};

    var drSkuAPI = require('*/cartridge/scripts/services/digitalRiverSKU');
    var testId = '1234567890';
    var bodySku = {
        eccn: 'EAR99',
        countryOfOrigin: 'US',
        taxCode: '4323.310_A',
        partNumber: '1234567890',
        name: 'Test Product',
        fulfill: false
    };

    var result = drSkuAPI.putSKU(testId, bodySku);
    if (result.ok || JSON.parse(result.errorMessage).type === 'conflict') {
        resp.sku = 'online';
    } else {
        resp.sku = 'offline';
    }

    var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
    var testEmail = '1234567890@digitalriver.com';

    var resultCheck = drCustomerAPI.createCustomer(testEmail);
    if (resultCheck.ok || JSON.parse(resultCheck.errorMessage).type === 'conflict') {
        resp.checkout = 'online';
    } else {
        resp.checkout = 'offline';
    }

    var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
    var checkoutBody = {
        sourceId: '',
        currency: 'USD',
        taxInclusive: false,
        browserIp: '111.111.111.111',
        email: 'null@digitalriver.com',
        shipTo: {
            address: {
                line1: '10380 Bren Road West',
                city: 'Minnetonka',
                postalCode: '55343',
                state: 'MN',
                country: 'US'
            },
            name: 'William Brown'
        },
        items: [
            {
                skuId: '1234567890',
                quantity: 3,
                price: 5.99,
                metadata: {
                    key1_LineLevel: '123456789'
                }
            }],
        upstreamId: '1234567890',
        metadata: {
            key1_OrderLevel: 12345,
            key2_OrderLevel: true
        }
    };
    var resultCust = drCheckoutAPI.createTestCheckout(checkoutBody);
    if (resultCust.ok || JSON.parse(resultCust.errorMessage).type === 'conflict') {
        resp.customer = 'online';
    } else {
        resp.customer = 'offline';
    }

    response.setContentType('application/json');
    response.writer.print(JSON.stringify({ response: resp }));
}

/**
 * Returns available action message for sending modified products job
 *
 * @param {string} jobType - type of job - site preference attribute name
 * @returns {string} action message
 */
var getActionMessage = function (jobType) {
    var isJobInProgress = Site.getCurrent().getCustomPreferenceValue(jobType);
    var actionMessageId = isJobInProgress ? 'dr.triggerjob.inprogress' : null;
    actionMessageId = actionMessageId || (jobType === JOBTYPES.allProducts ? 'dr.triggerjob.allproducts.start' : 'dr.triggerjob.start');
    var actionMessage = Resource.msg(actionMessageId, 'digitalriver', null);

    return actionMessage;
};

/**
 * Shows Trigger Delta Job Run page
 */
function ShowDeltaJobTrigger() {
    ISML.renderTemplate('digitalriverbm/triggerDeltaJob', {
        actionMessageModifiedProducts: getActionMessage(JOBTYPES.onlyModifiedProducts),
        actionMessageAllProducts: getActionMessage(JOBTYPES.allProducts),
        actionUrlModifiedProducts: URLUtils.url('DigitalRiver-TriggerDeltaSkuUpdateJob'),
        actionUrlAllProducts: URLUtils.url('DigitalRiver-TriggerAllSkusJob')
    });
}

/**
 * Switches site preference for job
 *
 * @param {string} jobType - type of job - site preference attribute name
 */
function triggerJob(jobType) {
    var currentSite = Site.getCurrent();
    var inProgressMessage = Resource.msg('dr.triggerjob.inprogress', 'digitalriver', null);
    var onlyVerify = request.httpParameterMap.actionMessage === inProgressMessage;
    if (!onlyVerify) {
        var isJobInProgress = currentSite.getCustomPreferenceValue(jobType);
        if (!isJobInProgress) {
            Transaction.wrap(function () {
                currentSite.setCustomPreferenceValue(jobType, true);
            });
        }
    }

    response.setContentType('application/json');
    response.writer.print(JSON.stringify({ actionMessage: getActionMessage(jobType) }));
}

/**
 * Switches site preference for job custom.scheduledDeltaSKU
 */
function TriggerDeltaSkuUpdateJob() {
    triggerJob(JOBTYPES.onlyModifiedProducts);
}

/**
 * Switches site preference for job custom.scheduledAllSKU
 */
function TriggerAllSkusJob() {
    triggerJob(JOBTYPES.allProducts);
}

/**
 * This function renders a object as a json response
 * @param {Object} object object
 */
function renderJSON(object) {
    ISML.renderTemplate('digitalriverbm/util/json', {
        jsonObject: object
    });
}

var supportedCountriesAndCurrenciesJSON = require('*/cartridge/supportedCountriesAndCurrencies.json');
var countriesJSON = require('*/cartridge/config/countries.json');
var supportedCountries = supportedCountriesAndCurrenciesJSON.countries;
var supportedCurrencies = supportedCountriesAndCurrenciesJSON.currencies;
var currentSite = Site.getCurrent();

/**
 * Renders the template for the CountryCurrencyPairs page
 * @param {Object} supportedCountries - an object containing the supported countries
 * @param {Object} supportedCurrencies - an object containing the supported currencies
 * @param {Object} countryCurrencyPairs - an object containing the country-currency pairs
 */
function CountryCurrencyPairs() {
    var countryCurrencyPairsNames = [];
    var countryCurrencyPairsCodes = [];
    var countryCurrencyPairs = JSON.parse(Site.getCurrent().getCustomPreferenceValue('drCountryCurrencyPairs')) || {};
    Object.keys(countryCurrencyPairs).forEach(function (country) {
        countryCurrencyPairs[country].forEach(function (currency) {
            countryCurrencyPairsNames.push(supportedCountries[country].name + ' - ' + supportedCurrencies[currency].name);
            countryCurrencyPairsCodes.push(country + '-' + currency);
        });
    });
    var supportedPairs = {};
    for (var i = 0; i < countriesJSON.length; i += 1) {
        let countryCode = countriesJSON[i].id.split('_')[1];
        if (Object.hasOwnProperty.call(supportedCountries, countryCode) && countriesJSON[i].alternativeCurrencyCodes) {
            supportedPairs[countryCode] = countriesJSON[i].alternativeCurrencyCodes;
            if (supportedPairs[countryCode].indexOf(countriesJSON[i].currencyCode) === -1) {
                supportedPairs[countryCode].unshift(countriesJSON[i].currencyCode);
            }
        }
    }
    ISML.renderTemplate('digitalriverbm/manageSupportedCountryandCurrency', {
        supportedPairs: JSON.stringify(supportedPairs),
        supportedCountriesAndCurrencies: JSON.stringify(supportedCountriesAndCurrenciesJSON),
        countryCurrencyPairsNames: JSON.stringify(countryCurrencyPairsNames),
        countryCurrencyPairsCodes: JSON.stringify(countryCurrencyPairsCodes)
    });
}

/**
 * Adds a country-currency pair to the list of supported countries and currencies
 * @param {dw.system.Site} currentSite - the current site object
 * @param {dw.web.HttpParameterMap} data - the request data
 * @param {string} country - the country code
 * @param {string} currency - the currency code
 */
function AddCountryCurrency() {
    var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.dynamicpricing');
    var data;
    var country;
    var currency;
    var supportedCountriesAndCurrencies;
    try {
        data = request.httpParameterMap;
        country = data.country.stringValue;
        currency = data.currency.stringValue;
        supportedCountriesAndCurrencies = JSON.parse(currentSite.getCustomPreferenceValue('drCountryCurrencyPairs')) || {};
        if (!Object.hasOwnProperty.call(supportedCountriesAndCurrencies, country)) {
            supportedCountriesAndCurrencies[country] = [currency];
        } else if (supportedCountriesAndCurrencies[country].indexOf(currency) === -1) {
            supportedCountriesAndCurrencies[country].push(currency);
        } else {
            logger.error('Currency already exists for the country {0}', supportedCountries[country].name);
            renderJSON({
                error: 'Currency already exists for the country ' + supportedCountries[country].name,
                success: false
            });
            return;
        }
        Transaction.wrap(function () {
            currentSite.setCustomPreferenceValue('drCountryCurrencyPairs', JSON.stringify(supportedCountriesAndCurrencies));
        });
    } catch (error) {
        logger.error('Supported country-currency pair could not be added {0}', error.message + error.stack);
        renderJSON({
            error: error,
            success: false
        });
        return;
    }
    logger.info('Supported country-currency pair added ({0})', `${country}-${currency}`);
    renderJSON({
        success: true
    });
}

/**
 * Deletes a country-currency pair from the list of supported countries and currencies
 * @param {dw.web.HttpParameterMap} data - the http parameter map
 * @param {string} countryCurrencyPair - the country-currency pair to be deleted
 * @param {string} country - the country to be deleted
 * @param {string} currency - the currency to be deleted
 * @param {Object} supportedCountriesAndCurrencies - the list of supported countries and currencies
 */
function DeleteCountryCurrency() {
    var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.dynamicpricing');
    var data;
    var deletedCountryCurrencyPair;
    var country;
    var currency;
    var supportedCountriesAndCurrencies;
    try {
        data = request.httpParameterMap;
        deletedCountryCurrencyPair = data.deletedCountryCurrencyPair.stringValue;
        country = deletedCountryCurrencyPair.split('-')[0];
        currency = deletedCountryCurrencyPair.split('-')[1];
        supportedCountriesAndCurrencies = JSON.parse(currentSite.getCustomPreferenceValue('drCountryCurrencyPairs')) || {};
        if (Object.hasOwnProperty.call(supportedCountriesAndCurrencies, country)) {
            var index = supportedCountriesAndCurrencies[country].indexOf(currency);
            if (index > -1) {
                supportedCountriesAndCurrencies[country].splice(index, 1);
            }
            if (supportedCountriesAndCurrencies[country].length === 0) {
                delete supportedCountriesAndCurrencies[country];
            }
        } else {
            logger.error('Country {0} does not exist in the list of supported countries and currencies', supportedCountries[country].name);
            renderJSON({
                error: Resource.msgf('dr.error.country.not.found', 'digitalriver', null, supportedCountries[country].name),
                success: false

            });
            return;
        }
        Transaction.wrap(function () {
            currentSite.setCustomPreferenceValue('drCountryCurrencyPairs', JSON.stringify(supportedCountriesAndCurrencies));
        });
    } catch (error) {
        logger.error('Supported country-currency pair could not be deleted {0}', error.message + error.stack);
        renderJSON({
            error: error,
            success: false

        });
        return;
    }
    renderJSON({
        success: true
    });
}

module.exports.Start = Start;
exports.Start.public = true;

module.exports.TestServices = TestServices;
exports.TestServices.public = true;

module.exports.ShowDeltaJobTrigger = ShowDeltaJobTrigger;
exports.ShowDeltaJobTrigger.public = true;

module.exports.TriggerDeltaSkuUpdateJob = TriggerDeltaSkuUpdateJob;
exports.TriggerDeltaSkuUpdateJob.public = true;

module.exports.TriggerAllSkusJob = TriggerAllSkusJob;
exports.TriggerAllSkusJob.public = true;

module.exports.CountryCurrencyPairs = CountryCurrencyPairs;
exports.CountryCurrencyPairs.public = true;

module.exports.AddCountryCurrency = AddCountryCurrency;
exports.AddCountryCurrency.public = true;

module.exports.DeleteCountryCurrency = DeleteCountryCurrency;
exports.DeleteCountryCurrency.public = true;
