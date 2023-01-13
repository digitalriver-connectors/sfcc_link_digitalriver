'use strict';
/* globals DigitalRiver */
var scrollAnimate = require('base/components/scrollAnimate');

/**
 * Displays error message to user
 *
 * @param {string} msg message to be shown
 */
function checkoutError(msg) {
    $('.dropin-form-error-message').show();
    $('.error-message-text').html(msg);
    scrollAnimate($('.dropin-form-error-message'));
}

/**
 * @param {Object} source data provided as parameter to Drop-in onSuccess listener
 * Serializes and sends payment form
 */
function submitDropInData(source) {
    $.ajax({
        url: $('#drop-in').data('url'),
        type: 'post',
        dataType: 'json',
        data: {
            source: JSON.stringify(source),
            csrf_token: $('*[name=csrf_token]').val()
        },
        success: function (data) {
            location.href = data.redirectUrl;
        },
        error: function (err) {
            if (err.responseJSON.redirectUrl) {
                window.location.href = err.responseJSON.redirectUrl;
            } else {
                checkoutError(err.responseJSON.message);
            }
        }
    });
}

/**
 * Sends form data to get drop-in configuration and launch drop-in
 */
function getConfigAndLaunchDropIn() {
    var $form = $('#dropInAddressForm');
    // remove previous error messages if any
    $form.find('.form-control.is-invalid').removeClass('is-invalid');
    $form.find('.invalid-feedback').text('');
    $('.dropin-form-error-message').hide();
    // get drop-in configuration
    $.ajax({
        url: $form.attr('action'),
        method: 'POST',
        data: $form.serialize(),
        success: function (data) {
            if (!data.error) {
                var digitalriverpayments = new DigitalRiver(data.APIKey, {
                    locale: data.currentLocaleId
                });
                var configuration = data.dropInConfiguration;
                configuration.options = {
                    showComplianceSection: false,
                    flow: 'managePaymentMethods'
                };

                configuration.onSuccess = function (successData) {
                    submitDropInData(successData.source);
                };
                configuration.onError = function (errorData) {
                    $('.invalid-dropin-feeback').text(errorData.errors.shift().message);
                    $('.invalid-dropin-feeback').show();
                };
                configuration.onCancel = function () {
                    window.location.href = data.cancelRedirectUrl;
                };
                var dropin = digitalriverpayments.createDropin(configuration);
                dropin.mount('drop-in');
                $('#openDropIn').hide();
                $('#closeDropIn').show();
                $('fieldset.billing-address-block').prop('disabled', true);
                $('fieldset.contact-info-block').prop('disabled', true);
            } else {
                data.fieldErrors.forEach(function (error) {
                    Object.keys(error).forEach(function (fieldName) {
                        $('*[name=' + fieldName + ']', $form)
                            .addClass('is-invalid')
                            .siblings('.invalid-feedback')
                            .text(error[fieldName]);
                    });
                });
            }
        },
        error: function (err) {
            checkoutError(err.responseJSON.message);
        }
    });
}

$(document).ready(function () {
    $('#openDropIn').on('click', function () {
        getConfigAndLaunchDropIn();
    });
    $('#closeDropIn').on('click', function () {
        $('#openDropIn').show();
        $('#closeDropIn').hide();
        $('div#drop-in').empty();
        $('fieldset.billing-address-block').prop('disabled', false);
        $('fieldset.contact-info-block').prop('disabled', false);
    });
});
