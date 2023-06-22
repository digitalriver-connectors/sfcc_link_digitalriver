/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./cartridges/bm_digitalriver/cartridge/client/default/js/supportedCountriesAndCurrencies.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./cartridges/bm_digitalriver/cartridge/client/default/js/supportedCountriesAndCurrencies.js":
/*!***************************************************************************************************!*\
  !*** ./cartridges/bm_digitalriver/cartridge/client/default/js/supportedCountriesAndCurrencies.js ***!
  \***************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


jQuery.noConflict();

jQuery(document).ready(function ($) {
    const countryCurrencyPairsNames = JSON.parse(
        $('#countryCurrencyPairsNames').val()
    );
    const countryCurrencyPairsCodes = JSON.parse(
        $('#countryCurrencyPairsCodes').val()
    );
    const error = $('.error');

    /**
     * Loads the selected country-currency pairs into the DOM
     * @param {Array} pairNames - array of country-currency pair names
     * @param {Array} pairCodes - array of country-currency pair codes
     */
    function loadSelectedCountryCurrency(
        pairNames,
        pairCodes
    ) {
        const selectedCountryCurrencyList = $(
            '#selected-country-currency-list'
        );

        for (let i = 0; i < pairNames.length; i++) {
            const div = $('<div>').addClass('form-group');
            const input = $('<input>')
                .attr({
                    type: 'text',
                    name: 'countryCurrencyPair',
                    value: pairNames[i],
                    readonly: true
                })
                .addClass('form-control drbm-dp-input');
            const button = $('<button>')
                .attr({
                    type: 'button',
                    name: 'removeCountryCurrencyPair',
                    value: pairCodes[i]
                })
                .addClass('btn btn-danger drbm-dp-remove-btn')
                .text('Remove');

            button.on('click', function () {
                const deletedCountryCurrencyPair = $(this).val();
                $.ajax({
                    url: $('#add-country-currency').data('delete-url'),
                    type: 'post',
                    dataType: 'json',
                    data: {
                        deletedCountryCurrencyPair
                    },
                    success: function (response) {
                        if (response.error) {
                            error.text(response.error);
                            error.removeClass('hidden');
                            return false;
                        }
                        div.remove();
                        error.addClass('hidden');
                        return true;
                    },
                    error: function () {
                        error.text(
                            'Error while removing the country-currency pair. Please try again later'
                        );
                        error.removeClass('hidden');
                        return false;
                    }
                });
            });

            div.append(input).append(button);
            selectedCountryCurrencyList.append(div);
        }
    }

    /**
     * Creates a dynamic pricing selector for the supported countries and currencies
     * @param {Object} countrySelect - the country select element
     * @param {Object} currencySelect - the currency select element
     * @param {Object} addButton - the add button element
     * @param {Object} supportedCountriesAndCurrencies - the supported countries and currencies
     * @param {Object} countries - the countries object
     * @param {Object} currencies - the currencies object
     * @param {Object} supportedPairs - the supported pairs object
     */
    function getDynamicPricingSelector() {
        var countrySelect = $('#country-select');
        var currencySelect = $('#currency-select');
        var addButton = $('#add-country-currency');
        var supportedCountriesAndCurrencies = addButton.data('supported-countries-currencies');
        var countries = supportedCountriesAndCurrencies.countries;
        var currencies = supportedCountriesAndCurrencies.currencies;
        var supportedPairs = JSON.parse($('#supportedPairs').val());

        // Populate the country select with the supported countries
        for (let i = 0; i < Object.keys(supportedPairs).length; i++) {
            let country = Object.keys(supportedPairs)[i];

            let option = $('<option>', {
                value: country,
                text: countries[country].name,
                class: 'countryName'
            });

            countrySelect.append(option);
        }

    // Update the currency select when the country select changes
        countrySelect.on('change', () => {
        // Clear the currency select
            currencySelect.empty();

        // Get the selected country
            var selectedCountry = countrySelect.val();

        // Populate the currency select with the values for the selected country
            for (var currency of supportedPairs[selectedCountry]) {
                let option = $('<option>', {
                    value: currency,
                    text: currencies[currency].name
                });
                currencySelect.append(option);
            }
        });
    }
    /**
     * Adds a country-currency pair to the list of selected country-currency pairs
     * @param {Object} country - the selected country
     * @param {Object} currency - the selected currency
     */
    function addCountryCurrency() {
        $('#add-country-currency').on('click', function () {
            const country = $('#country-select');
            const currency = $('#currency-select');
            const selectedCountry = country.find('option:selected');
            const selectedCurrency = currency.find('option:selected');
            const fieldText = selectedCountry.text() + ' - ' + selectedCurrency.text();

            if (fieldText.includes('Select')) {
                if (
                    selectedCountry.text().includes('Select') &&
                    selectedCurrency.text().includes('Select')
                ) {
                    error.text('Please select a country and a currency.');
                } else if (selectedCountry.text().includes('Select')) {
                    error.text('Please select a country.');
                } else if (selectedCurrency.text().includes('Select')) {
                    error.text('Please select a currency.');
                }
                error.removeClass('hidden');
                return false;
            }

            // Make AJAX call
            $.ajax({
                url: $(this).data('add-url'),
                type: 'post',
                dataType: 'json',
                data: {
                    country: selectedCountry.val(),
                    currency: selectedCurrency.val()
                },
                success: function (response) {
                    if (response.error) {
                        error.text(response.error);
                        error.removeClass('hidden');
                        return false;
                    }
                    loadSelectedCountryCurrency(
                        [fieldText],
                        [`${selectedCountry.val()}-${selectedCurrency.val()}`]
                    );
                    error.addClass('hidden');
                    return true;
                },
                error: function () {
                    error.text('Error while adding country currency pair');
                    error.removeClass('hidden');
                    return false;
                }
            });
            return true;
        });
    }

    getDynamicPricingSelector();
    loadSelectedCountryCurrency(
        countryCurrencyPairsNames,
        countryCurrencyPairsCodes
    );
    addCountryCurrency();
});


/***/ })

/******/ });
//# sourceMappingURL=supportedCountriesAndCurrencies.js.map