'use strict';

var formValidation = require('base/components/formValidation');
var summaryHelpers = require('./summary');
var drHelper = require('./drHelper');
var taxExemptData = $('.us-tax-certificate-list').data('tax-exempt');
const DR_BUSINESS_CUSTOMER = 'business';

/**
 * Update view table of Tax Certificates
 * @param {string} customerType - Digital River customer type
 * @param {boolean} isNewCheckout - create new Digital River checkout
 */
function updateTaxCerificatesTable(customerType, isNewCheckout) {
    $.spinner().start();
    $.ajax({
        url: $('.us-tax-certificate-list').data('url') + '?customer_type=' + customerType + (isNewCheckout ? '&stage=new' : ''),
        method: 'GET',
        dataType: 'json',
        success: function (data) {
            $('.us-certificate-table').empty();
            $('.us-certificate-table').html(data.renderedTemplate);
            summaryHelpers.updateTotals(data.order.totals);
            // Update DropIn configuration
            if (isNewCheckout && data.digitalRiverConfiguration) {
                $('body').trigger('digitalRiver:updateDropIn', data.digitalRiverConfiguration);
            }
        },
        error: function (err) {
            if (err.responseJSON && err.responseJSON.redirectUrl) {
                window.location.href = err.responseJSON.redirectUrl;
            }
        },
        complete: function () {
            $.spinner().stop();
        }
    });
}

/**
 * Clear Tax Certificate Form
 */
function clearTaxCertificateForm() {
    $('.certificate-error-message').hide();
    $('.error-message-text').empty();

    var form = $('form[name=dwfrm_taxCertificate]');
    if (!form) {
        return;
    }

    $('input[name$=_companyName]', form).val('');
    $('select[name$=_country]', form).val('US');
    $('select[name$=_stateCode],input[name$=_stateCode]', form).val('');
    $('input[name$=_startDate]', form).val('');
    $('input[name$=_endDate]', form).val('');
    $('input[name$=_imageFile]', form).val('');
    $('label.custom-file-label').empty();
}

/**
 * Hides/shows tax certificates list
 */
function toggleTaxCertificatesList() {
    var isBusinessType = $('#typeBusiness').prop('checked');
    var isTaxExemptEnable = Object.keys(taxExemptData).every(function (key) {
        return !!taxExemptData[key];
    });
    $('.us-tax-certificate-list').toggle(isBusinessType && isTaxExemptEnable);
}

module.exports = {
    handleBillingChange: function () {
        $('select[name$="billing_addressFields_country"]').on('change', function () {
            var isDigitalCart = $('#accordionBilling').data('digital-cart');
            if (isDigitalCart) {
                taxExemptData.validCountry = this.value === 'US';
                toggleTaxCertificatesList();
            }
        });
    },
    handleShippingChange: function () {
        $('body').on('digitalRiver:taxCertificate', function (e, updatedTaxExemptData) {
            var isDigitalCart = $('#accordionBilling').data('digital-cart');
            taxExemptData = updatedTaxExemptData;
            if (isDigitalCart) {
                taxExemptData.validCountry = $('select[name$="billing_addressFields_country"]').val() === 'US';
            }
            toggleTaxCertificatesList();
        });
    },
    manageCertificarte: function () {
        $('input[type=radio][name=purchaseType]').change(function () {
            toggleTaxCertificatesList();
        });
    },
    addTaxCertificate: function () {
        $('.add-new-certificate').on('click', function () {
            clearTaxCertificateForm();
            $('#addTaxCertificateModal').modal('show');
        });
    },
    submitCertificate: function () {
        $('form.tax-certificate-form').submit(function (e) {
            var $form = $(this);
            e.preventDefault();
            var url = $form.attr('action');
            $form.spinner().start();
            $('tax-certificate-form').trigger('certificate:submit', e);

            // check file extension
            var $certificateErrorMessage = $('.certificate-error-message');
            var files = $('input[name$=_imageFile]', $form).prop('files');
            if (!drHelper.checkAllowedFilesType(files)) {
                var errorMessage = $certificateErrorMessage.data('error-message');
                $('.error-message-text').text(errorMessage);
                $certificateErrorMessage.show();
                $form.spinner().stop();
                return false;
            }
            $certificateErrorMessage.hide();

            var formData = new FormData(this);

            $.ajax({
                url: url,
                contentType: false,
                processData: false,
                method: 'POST',
                data: formData,
                success: function (data) {
                    if (!data.success) {
                        if (data.errorMessage) {
                            $('.certificate-error-message').show();
                            $('.error-message-text').text(data.errorMessage);
                        } else {
                            formValidation($form, data);
                        }
                    } else {
                        $('#addTaxCertificateModal').modal('hide');
                        updateTaxCerificatesTable(DR_BUSINESS_CUSTOMER, true);
                    }
                },
                error: function (err) {
                    if (err.responseJSON && err.responseJSON.redirectUrl) {
                        window.location.href = err.responseJSON.redirectUrl;
                    }
                },
                complete: function () {
                    $form.spinner().stop();
                }
            });
            return false;
        });
    },
    selectFile: function () {
        $('#imageFile').on('change', function () {
            var $inputField = $(this);
            var fileName = $inputField.val().replace(/.*(\/|\\)/, '');
            $inputField.siblings('.custom-file-label').addClass('selected').html(fileName);
        });
    }
};
