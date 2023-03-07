'use strict';

var addressHelpers = require('base/checkout/address');
var formHelpers = require('base/checkout/formErrors');
var drHelper = require('./drHelper');
var updatedDigitalRiverConfiguration = null;

/**
 * @param {Object} digitalRiverConfiguration received from back-end
 * Configures and shows drop-in menu when event is triggered
 */
function mountDropIn(digitalRiverConfiguration) {
    $('#accordionBilling').spinner().start();
    $('#drop-in').empty();
    $('#dropInContainer').data('mounted', false);

    var digitalRiverPayments = new DigitalRiver(digitalRiverConfiguration.APIKey, { // eslint-disable-line no-undef
        locale: digitalRiverConfiguration.currentLocaleId
    });
    var dropInConfiguration = digitalRiverConfiguration.dropInConfiguration;

    if (Object.hasOwnProperty.call(dropInConfiguration, 'options')) {
        dropInConfiguration.options.showComplianceSection = false;
    } else {
        dropInConfiguration.options = {
            showComplianceSection: false
        };
    }

    dropInConfiguration.onSuccess = function (returnedData) {
        // Update billing address after closing the widget for PayPal payment
        var form = $('form[name=dwfrm_billing]');
        var isCountrySupported = $('select[name$=_country] option[value='
            + returnedData.source.owner.address.country
            + ']', form).length > 0;

        if (!isCountrySupported) {
            drHelper.checkoutError($('#dropInContainer').data('country-error-msg'));
            return;
        }

        $('input[name$=_firstName]', form).val(returnedData.source.owner.firstName);
        $('input[name$=_lastName]', form).val(returnedData.source.owner.lastName);
        $('input[name$=_address1]', form).val(returnedData.source.owner.address.line1);
        $('input[name$=_address2]', form).val(returnedData.source.owner.address.line2);
        $('input[name$=_city]', form).val(returnedData.source.owner.address.city);
        $('input[name$=_postalCode]', form).val(returnedData.source.owner.address.postalCode);
        $('select[name$=_stateCode],input[name$=_stateCode]', form)
            .val(returnedData.source.owner.address.state);
        $('select[name$=_country]', form).val(returnedData.source.owner.address.country);
        if (form && returnedData.source.payPal) {
            $('input[name$=_phone]', form).val(returnedData.source.owner.phoneNumber);
        }

        var submitPaymentUrl = $('#drop-in').attr('data-submit-url');
        $('#saveCreditCard').prop('checked', returnedData.readyForStorage);
        $.ajax({
            url: submitPaymentUrl,
            type: 'post',
            data: {
                drData: JSON.stringify(returnedData.source)
            },
            success: function (data) {
                if (data.error) {
                    drHelper.checkoutError(data.errorMessage);
                } else {
                    // save dropIn summary
                    $('#drop-in').attr('data-dropin-summary', JSON.stringify(data.dropInSummary));
                    drHelper.updateComplianceEntity(data.complianceEntity);
                    // redirect to place order
                    $('.submit-payment').trigger('click');
                }
            },
            error: function (err) {
                drHelper.checkoutError(err.responseJSON.message);
            }
        });
    };

    dropInConfiguration.onError = function (data) {
        var logErrorUrl = $('#drop-in').attr('data-logmessage-url');
        $.ajax({
            url: logErrorUrl,
            type: 'post',
            data: {
                message: data.errors[0].message
            },
            success: function (successData) { // eslint-disable-line no-unused-vars
                // Nothing to now
            },
            error: function (err) { // eslint-disable-line no-unused-vars
                // Nothing to now
            }
        });
        drHelper.checkoutError(digitalRiverConfiguration.paymentErrorMessage);
    };

    dropInConfiguration.onReady = function () {
        $('#dropInContainer').data('mounted', true);
        $('#accordionBilling').spinner().stop();
        updatedDigitalRiverConfiguration = digitalRiverConfiguration;
    };

    dropInConfiguration.onCancel = function () {
        window.location.href = digitalRiverConfiguration.cancelRedirectUrl;
    };

    var dropin = digitalRiverPayments.createDropin(dropInConfiguration);
    dropin.mount('drop-in');
}

/**
 * @param {string} configUrl endpoint to get drop-in configuration
 * Sends request to backend to get configuration and triggers drop-in creation event
 */
function initDropIn(configUrl) {
    $('#drop-in').spinner().start();
    $.ajax({
        url: configUrl,
        type: 'get',
        success: function (data) {
            $('body').trigger('digitalRiver:dropIn', data);
        },
        error: function (err) {
            drHelper.checkoutError(err.responseJSON.message);
        },
        complete: function () {
            $('#drop-in').spinner().stop();
        }
    });
}

/**
 * Initiates events listener for add-payment button that will mount drop-in on click
 */
function initEvents() {
    var $dropinContainer = $('#dropInContainer');
    if ($dropinContainer.length > 0 && $dropinContainer.data('enabled')) {
        $('body').on('digitalRiver:dropIn', function (e, digitalRiverConfiguration) {
            if ($('.saved-payment-instrument').length === 0) { // if there are no saved payment methods, mount drop-in
                mountDropIn(digitalRiverConfiguration);
            } else { // otherwise set event listener to mount drop-in only when customer wants to add new payment
                $('.add-payment').on('click', function () {
                    updatedDigitalRiverConfiguration = digitalRiverConfiguration;
                    $('#collapse-payment').trigger('show.bs.collapse');
                });
            }
        });
        if ($('.data-checkout-stage').data('checkout-stage') === 'payment' || $('.DR-place-order').data('dr-redirect-error')) { // for cases when page is refreshed by customer in the process of checkout and for redirect errors
            initDropIn($dropinContainer.data('config-url'));
        }
        $('body').on('digitalRiver:updateDropIn', function (e, digitalRiverConfiguration) {
            if (updatedDigitalRiverConfiguration) {
                updatedDigitalRiverConfiguration.dropInConfiguration.sessionId = digitalRiverConfiguration.dropInConfiguration.sessionId;
                $('body').trigger('digitalRiver:dropIn', updatedDigitalRiverConfiguration);
            } else {
                $('body').trigger('digitalRiver:dropIn', digitalRiverConfiguration);
            }
        });
    }

    $('#headingTaxIdentifier').on('click', function (event) {
        // Clear form errors
        formHelpers.clearPreviousErrors('.payment-form');

        // Check billing form
        var emptyAddressFields = {};
        $('form[name$=billing] input[required], form[name$=billing] select[required]').each(function () {
            if (!this.value) {
                emptyAddressFields[this.name] = 'The field is not filled';
            }
        });

        if (Object.keys(emptyAddressFields).length) {
            formHelpers.loadFormErrors('.payment-form', emptyAddressFields);
            event.stopPropagation();
        }
    });

    $('#headingPayment').on('click', function (event) {
        // Clear form errors
        formHelpers.clearPreviousErrors('.payment-form');

        // Check billing form
        var emptyAddressFields = {};
        $('form[name$=billing] input[required], form[name$=billing] select[required]').each(function () {
            if (!this.value) {
                emptyAddressFields[this.name] = 'The field is not filled';
            }
        });

        if (Object.keys(emptyAddressFields).length) {
            formHelpers.loadFormErrors('.payment-form', emptyAddressFields);
            event.stopPropagation();
        }
    });

    $('#collapse-payment').on('show.bs.collapse', function () {
        if (updatedDigitalRiverConfiguration) {
            // Update address if all required fields are filled
            var form = $('form[name$=billing]')[0];
            var addressUI = addressHelpers.methods.getAddressFieldsFromUI(form);
            var $summaryDetails = $('.customer-summary .summary-details');
            updatedDigitalRiverConfiguration.dropInConfiguration.billingAddress = {
                email: $summaryDetails.find('.customer-summary-email').text(),
                firstName: addressUI.firstName,
                lastName: addressUI.lastName,
                phoneNumber: addressUI.phone,
                address: {
                    city: addressUI.city,
                    country: addressUI.countryCode,
                    line1: addressUI.address1,
                    line2: addressUI.address2,
                    postalCode: addressUI.postalCode,
                    state: addressUI.stateCode
                }
            };
            mountDropIn(updatedDigitalRiverConfiguration);
        }
    });

    $('#dr-cb-confirm').change(function () {
        if ($(this).prop('checked')) {
            $('body').trigger('checkout:enableButton', '.next-step-button .place-order');
        } else {
            $('body').trigger('checkout:disableButton', '.next-step-button .place-order');
        }
    });
    $('#dr-cb-confirm').trigger('change');
}

module.exports = {
    initEvents: initEvents
};
