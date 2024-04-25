'use strict';

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

        for (let i = 0; i < pairNames.length; i += 1) {
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
        for (let i = 0; i < Object.keys(supportedPairs).length; i += 1) {
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
            var currencyArray = supportedPairs[selectedCountry];
            for (var j = 0; j < currencyArray.length; j += 1) {
                var currency = currencyArray[j];
                var option = $('<option>', {
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
                    selectedCountry.text().includes('Select')
                    && selectedCurrency.text().includes('Select')
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
