'use strict';

(function ($) {
    $(document).ready(function () {
        /**
         * Creates a dynamic pricing selector for a given element
         * @param {number} element - the index of the element to create the selector for
         * @returns {void}
         */
        function getDynamicPricingSelector(element) {
            var countrySelect = $('.dr-country-select').eq(element);
            var currencySelect = $('.dr-currency-select').eq(element);
            var selectButton = $('.dr-select-button').eq(element);

            var modalData = $('.scc-modal-data');

            var countryCurrencyPairs = modalData.data('country-currency-pairs');
            var supportedCountriesAndCurrencies = modalData.data('supported-countries-currencies');
            var countries = supportedCountriesAndCurrencies.countries;
            var currencies = supportedCountriesAndCurrencies.currencies;
            var currentCountry = modalData.data('selected-country');
            var currentCurrency = modalData.data('selected-currency');

        // Keep track of the current country and currency index
        // so we can select them by default when the page loads
            var currentCountryIndex = 0;
            var currentCurrencyIndex = 0;

        // Populate the country select with the supported countries
            for (let i = 0; i < Object.keys(countryCurrencyPairs).length; i++) {
                let country = Object.keys(countryCurrencyPairs)[i];
                if (currentCountry === country) {
                    currentCountryIndex = i;
                }

                let option = $('<option>', {
                    value: country,
                    text: countries[country].name,
                    class: 'countryName'
                });

                countrySelect.append(option);
            }

        // Select the current country by default
            var countrySelected = Object.keys(countryCurrencyPairs)[currentCountryIndex];
            countrySelect.val(countrySelected);

        // Populate the currency select with the values for the selected country
            var currenciesForSelectedCountry = countryCurrencyPairs[countrySelected];
            for (let i = 0; i < currenciesForSelectedCountry.length; i++) {
                let currency = currenciesForSelectedCountry[i];
                if (currency === currentCurrency) {
                    currentCurrencyIndex = i;
                }

                let option = $('<option>', {
                    value: currency,
                    text: currencies[currency].name,
                    class: 'currencyName'
                });

                currencySelect.append(option);
            }

        // Select the current currency by default
            currencySelect.val(currenciesForSelectedCountry[currentCurrencyIndex]);

        // Update the currency select when the country select changes
            countrySelect.on('change', () => {
            // Clear the currency select
                currencySelect.empty();

            // Get the selected country
                var selectedCountry = countrySelect.val();

            // Populate the currency select with the values for the selected country
                for (var currency of countryCurrencyPairs[selectedCountry]) {
                    let option = $('<option>', {
                        value: currency,
                        text: currencies[currency].name
                    });
                    currencySelect.append(option);
                }
            });

        // Make a call to the SFRA controller when the button is clicked
            selectButton.on('click', (e) => {
                e.preventDefault();
            // Get the selected country and currency
                var selectedCountry = countrySelect.val();
                var selectedCurrency = currencySelect.val();
                var url = selectButton.data('url');
                var action = $('.page').data('action');
                var queryString = $('.page').data('querystring');
            // Make the AJAX call to the SFRA controller
                $.ajax({
                    url: url,
                    type: 'get',
                    dataType: 'json',
                    data: {
                        country: selectedCountry,
                        currency: selectedCurrency,
                        action: action,
                        queryString: queryString
                    },
                    success: (response) => {
                        if (response && response.redirectUrl) {
                            window.location.href = response.redirectUrl;
                        }
                        // Do something with the response data
                    },
                    error: () => {
                        // Handle the error
                    }
                });
            });
        }
        getDynamicPricingSelector(0);

        /**
         * Creates and populate a modal with dynamic pricing selector for a given element
         * @returns {void}
         */
        function showDynamicPricingModal() {
            var modalHeader = document.querySelector('input[name="scc-modal-header"]').value;
            var modalData = $('.scc-modal-data');

            var url = modalData.data('url');
            var countryCurrencyPairs = modalData.data('country-currency-pairs');
            var supportedCountriesCurrencies = modalData.data('supported-countries-currencies');
            var countries = supportedCountriesCurrencies.countries;
            var currencies = supportedCountriesCurrencies.currencies;
            var selectBtnResource = modalData.data('select-resource');
            var cancelBtnResource = modalData.data('select-cancel');
            var labelCountry = modalData.data('label-country');
            var labelCurrency = modalData.data('label-currency');
            var selectedCountry = modalData.data('selected-country');
            var selectedCurrency = modalData.data('selected-currency');

            var modalString = `
            <div class="modal show fade" id="country-and-currency-modal" role="dialog" aria-modal="true">
                <div class="modal-dialog">
                    <!-- Modal content-->
                    <div class="modal-content">
                        <div class="modal-header scc-header justify-content-center">${modalHeader}</div>
                        <div class="scc-body m-3">
                            <div class="form-field">
                                <label for="dr-country-select">${labelCountry}</label>
                                <select id="dr-country-select" class="form-control form-control-sm dr-country-select" data-selected-country=${selectedCountry}>
                                </select>
                            </div>
                            <div class="form-field">
                                <label for="dr-currency-select">${labelCurrency}</label>
                                <select id="dr-currency-select" class="form-control form-control-sm dr-currency-select" data-selected-currency=${selectedCurrency}>
                                </select>
                            </div>
                        </div>
                        <div class="scc-footer mx-auto my-3">
                            <button id="dr-select-button" class="dr-select-button dr-select-button-desktop btn btn-primary"
                                data-url="${url}"
                                data-country-currency-pairs="${countryCurrencyPairs}"
                                data-supported-countries-currencies="${supportedCountriesCurrencies}">
                                ${selectBtnResource}
                            </button>
                            <button type="button" class="btn btn-danger" data-dismiss="modal">${cancelBtnResource}</button>
                        </div>
                    </div>
                </div>
            </div>
            `;

            // Appending the modalString to the body element
            $('body').append(modalString);

            // Keep track of the current country and currency index
            // so we can select them by default when the page loads
            var currentCountryIndex = 0;
            var currentCurrencyIndex = 0;

            var countrySelect = $('#country-and-currency-modal #dr-country-select');
            // Populate the country select with the supported countries
            for (let i = 0; i < Object.keys(countryCurrencyPairs).length; i++) {
                let country = Object.keys(countryCurrencyPairs)[i];
                if (selectedCountry === country) {
                    currentCountryIndex = i;
                }

                let option = $('<option>', {
                    value: country,
                    text: countries[country].name,
                    class: 'countryName'
                });

                countrySelect.append(option);
            }
            // Select the current country by default
            var countrySelected = Object.keys(countryCurrencyPairs)[currentCountryIndex];
            countrySelect.val(countrySelected);

            var currencySelect = $('#country-and-currency-modal #dr-currency-select');
            // Populate the currency select with the values for the selected country
            var currenciesForSelectedCountry = countryCurrencyPairs[countrySelected];
            for (let i = 0; i < currenciesForSelectedCountry.length; i++) {
                let currency = currenciesForSelectedCountry[i];
                if (currency === selectedCurrency) {
                    currentCurrencyIndex = i;
                }

                let option = $('<option>', {
                    value: currency,
                    text: currencies[currency].name,
                    class: 'currencyName'
                });

                currencySelect.append(option);
            }
            // Select the current currency by default
            currencySelect.val(currenciesForSelectedCountry[currentCurrencyIndex]);

            // Update the currency select when the country select changes
            countrySelect.on('change', () => {
                // Clear the currency select
                currencySelect.empty();

                // Get the selected country
                var selectedCountries = countrySelect.val();

                // Populate the currency select with the values for the selected country
                for (var currency of countryCurrencyPairs[selectedCountries]) {
                    let option = $('<option>', {
                        value: currency,
                        text: currencies[currency].name
                    });
                    currencySelect.append(option);
                }
            });

            $('.change-scc-button').click(function (e) {
                e.preventDefault();
                // show the modal
                $('#country-and-currency-modal').modal('show');
            });

            // Make a call to the SFRA controller when the button is clicked
            $('.dr-select-button').on('click', (e) => {
                e.preventDefault();

                var action = $('.page').data('action');
                var queryString = $('.page').data('querystring');
                // Make the AJAX call to the SFRA controller
                $.ajax({
                    url: url,
                    type: 'get',
                    dataType: 'json',
                    data: {
                        country: countrySelect.val(),
                        currency: currencySelect.val(),
                        action: action,
                        queryString: queryString
                    },
                    success: (response) => {
                        if (response && response.redirectUrl) {
                            window.location.href = response.redirectUrl;
                        }
                        // Do something with the response data
                    },
                    error: () => {
                        // Handle the error
                    }
                });
            });
        }

        showDynamicPricingModal();
    });
}(window.jQuery));
