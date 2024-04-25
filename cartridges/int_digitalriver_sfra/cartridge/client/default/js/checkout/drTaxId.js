'use strict';

var drHelper = require('dr_customer_credit/checkout/drHelper');
var summaryHelpers = require('dr_customer_credit/checkout/summary');

var customerType;
var taxIdentifier;
var billingConutryChanged = false;
var purchaseTypeChanged = true;
var taxidentifierData = {
    fieldsWithError: {},
    fieldsWithSuccess: {}
};
var isDigitalCart = $('#accordionBilling').data('digital-cart');
var $btnTaxidentifierSubmit = $('.dr-btn-taxidentifier-submit');
const DR_BUSINESS_PURCHASE = 'business';
const DR_INDIVIDUAL_PURCHASE = 'individual';

/**
 * Recalculate Basket
 * @param {Object} order - Basket model
 */
function recalculateBasket(order) {
    summaryHelpers.updateTotals(order.totals);
    summaryHelpers.updateOrderProductSummaryInformation(order);
}

/**
 * Clears tax identifiers block
 */
function clearTaxIdentifiersBlock() {
    $('#tax-id').empty();
    $('#dr-list-of-applied-identifiers').empty();
    $btnTaxidentifierSubmit.hide();
}

/**
 * check list of errors and list of success, update button ability based on these lists
 * Apply button should be disabled until all errors are cleared and the valid tax identifier is provided
 */
function updateTaxIdentifierSubmitBtn() {
    if (Object.keys(taxidentifierData.fieldsWithError[customerType]).length) { // if have errors
        // disable button
        $btnTaxidentifierSubmit.prop('disabled', true);
    } else if (Object.keys(taxidentifierData.fieldsWithSuccess[customerType]).length) { // if have success (not empty)
        // enable button
        $btnTaxidentifierSubmit.prop('disabled', false);
    } else { // success id was deleted from input -> no errors && no success
        $btnTaxidentifierSubmit.prop('disabled', true);
    }
}

/**
 * @param {array} arrayOfAppliedIdentifiers - array of applied identifiers
 * @param {string} deleteText - localizable text for button
 */
function displayAppliedTaxIdentifiers(arrayOfAppliedIdentifiers, deleteText) {
    var appliedIdentifiersToHtml = '';
    for (var i = 0; i < arrayOfAppliedIdentifiers.length; i += 1) {
        var identifier = arrayOfAppliedIdentifiers[i];
        appliedIdentifiersToHtml += '<div class="dr-applied-identifier" data-id="' + identifier.id + '">';
        appliedIdentifiersToHtml += identifier.value;
        appliedIdentifiersToHtml += ' - <a href="#" class="dr-applied-identifier-delete">';
        appliedIdentifiersToHtml += deleteText;
        appliedIdentifiersToHtml += '</a></div>';
    }
    $('#dr-list-of-applied-identifiers').html(appliedIdentifiersToHtml);
}

/**
 * display tax identifier if ajax returns correct values
 * and mount from DR returns success
 * otherwise display message
 * @param {Object} taxIdConfig - configuration of 'taxidentifier' element
 */
function mountTaxIdentifier(taxIdConfig) {
    var taxIdContainer = $('#tax-id');
    var taxIdAccordion = $('#tax-id-accordion');
    if (taxIdAccordion.is(':hidden')) {
        return;
    }

    // unmount existing tax identifier
    if (taxIdentifier) {
        taxIdentifier.destroy();
    }
    // empty list of displayed identifiers
    displayAppliedTaxIdentifiers([]);

    // empty taxidentifier data
    taxidentifierData = {
        fieldsWithError: {},
        fieldsWithSuccess: {}
    };

    $btnTaxidentifierSubmit.prop('disabled', true); // disable apply button
    $btnTaxidentifierSubmit.hide(); // show only if we have tax identifier on mount

    var digitalRiver = new DigitalRiver(taxIdConfig.APIKey, { // eslint-disable-line no-undef
        locale: taxIdConfig.currentLocaleId
    });
    var options = {
        taxIdentifier: {
            sessionId: taxIdConfig.sessionId,
            country: taxIdConfig.country,
            type: taxIdConfig.type
        }
    };

    // create element
    taxIdentifier = digitalRiver.createElement('taxidentifier', options);

    taxIdentifier.on('change', function (event) {
        // if we have expected type of object
        if (event && event.identifier && event.identifier.type) {
            var TIType = event.identifier.type; // type of tax identifier
            customerType = event.identifier.customerType; // type of customer
            taxidentifierData.fieldsWithError[customerType] = taxidentifierData.fieldsWithError[customerType] || {};
            taxidentifierData.fieldsWithSuccess[customerType] = taxidentifierData.fieldsWithSuccess[customerType] || {};

            if (event.empty) { // when field is empty on change
                // remove field value from prepared lists
                delete taxidentifierData.fieldsWithError[customerType][TIType];
                delete taxidentifierData.fieldsWithSuccess[customerType][TIType];
            } else if (event.complete && event.error == null) { // we have some value in field and complete status
                // add to success
                taxidentifierData.fieldsWithSuccess[customerType][TIType] = event.identifier;
                // remove from errors
                delete taxidentifierData.fieldsWithError[customerType][TIType];
            } else { // we have some value in field and not complete status
                // add to errors
                taxidentifierData.fieldsWithError[customerType][TIType] = event.identifier;
                // remove from success
                delete taxidentifierData.fieldsWithSuccess[customerType][TIType];
            }
            updateTaxIdentifierSubmitBtn();
        }
    });

    taxIdentifier.on('ready', function (event) {
        // if we don't have tax identifier to show
        if (event.hasTaxIdentifier) {
            $btnTaxidentifierSubmit.show(); // but still disabled
        } else {
            taxIdContainer.append(taxIdConfig.msgNotApplicable); // show message Tax exemption not applicable for this order
        }
        taxIdContainer.spinner().stop();

        $('input[name="shopperType"]').change(function () {
            customerType = this.value;
            taxidentifierData.fieldsWithError[customerType] = taxidentifierData.fieldsWithError[customerType] || {};
            taxidentifierData.fieldsWithSuccess[customerType] = taxidentifierData.fieldsWithSuccess[customerType] || {};
            updateTaxIdentifierSubmitBtn();
        });
    });

    taxIdentifier.mount('tax-id');
}

/**
 * Loads configuration and mounts tax identifier
 */
function loadTaxIdentifierConfig() {
    var taxIdContainer = $('#tax-id');
    var configUrl = taxIdContainer.data('config-url');
    $btnTaxidentifierSubmit.prop('disabled', true); // disable apply button
    $.ajax({
        url: configUrl,
        type: 'get',
        success: function (taxIdConfig) {
            if (taxIdConfig.error) {
                drHelper.checkoutError(taxIdConfig.errorMessage);
                $('#accordionBilling').spinner().stop();
            } else {
                mountTaxIdentifier(taxIdConfig);
                recalculateBasket(taxIdConfig.order);
            }
        },
        error: function (err) {
            taxIdContainer.spinner().stop();
            drHelper.checkoutError(err.responseJSON.message);
        }
    });
}

/**
* Toggles the visibility and required attribute of the organization name input field based on the selected business type
*/
function toggleOrganizationInputField() {
    var isBusinessType = $('#typeBusiness').prop('checked');
    if (isBusinessType) {
        $('#organizationNameSection').removeClass('dr-organization-name hidden').addClass('dr-organization-name show');
        $('#organizationName').attr('required', true);
    } else {
        $('#organizationName').attr('required', false);
        $('#organizationNameSection').removeClass('dr-organization-name show').addClass('dr-organization-name hidden');
    }
}

/**
 * Initiates events listener for add-payment button that will mount drop-in on click
 */
function initEvents() {
    $('body').on('digitalRiver:taxIdentifier', function (e, taxIdConfig) {
        $('#tax-id-accordion').toggle(taxIdConfig.useTaxIdentifier);
        mountTaxIdentifier(taxIdConfig);
    });

    $('select[name$="billing_addressFields_country"]').on('change', function () {
        billingConutryChanged = true;
        if (isDigitalCart) {
            $('#tax-id-accordion').toggle(this.value !== 'US');
        }
    });

    $('input[type=radio][name=purchaseType]').change(function () {
        purchaseTypeChanged = true;
        toggleOrganizationInputField();
    });

    // update purchase type, billing address and mount tax identifier on billing apply
    $('#collapse-billing').on('hide.bs.collapse', function () {
        var taxIdContainer = $('#tax-id');
        var taxIdAccordion = $('#tax-id-accordion');
        var billingAddressForm = $('#dwfrm_billing .billing-address-block :input').serialize();
        var purchaseType = $('#typeBusiness').prop('checked') ? DR_BUSINESS_PURCHASE : DR_INDIVIDUAL_PURCHASE;

        if (purchaseTypeChanged) {
            billingAddressForm += '&purchaseType=' + purchaseType;
        }

        if (purchaseType === 'business') {
            var organizationName = $('#organizationName').prop('value');
            billingAddressForm += '&organizationName=' + organizationName;
        }

        if (billingConutryChanged) {
            billingAddressForm += '&billingCountryChanged=true';
        }

        var reloadTaxIdentifier = (purchaseTypeChanged && !taxIdAccordion.is(':hidden')) || (billingConutryChanged && isDigitalCart && !taxIdAccordion.is(':hidden'));
        if (reloadTaxIdentifier) {
            clearTaxIdentifiersBlock();
            taxIdContainer.spinner().start();
        }

        $.ajax({
            url: $('.purchase-type-selector').data('url'),
            type: 'post',
            data: billingAddressForm,
            success: function (data) {
                if (data.success) {
                    purchaseTypeChanged = false;
                    billingConutryChanged = false;
                    drHelper.updateComplianceEntity(data.digitalRiverComplianceOptions.compliance.businessEntityCode);
                    recalculateBasket(data.order);
                    if (reloadTaxIdentifier) {
                        loadTaxIdentifierConfig();
                    }
                }
            },
            error: function (err) {
                taxIdContainer.spinner().stop();
                drHelper.checkoutError(err.responseJSON.message);
            }
        });
    });

    // process tax identifiers
    $btnTaxidentifierSubmit.on('click', function () {
        var applyUrl = $(this).data('apply-url');
        $('#accordionBilling').spinner().start(); // don't allow to continue till process finish
        drHelper.clearError();

        $.ajax({
            url: applyUrl,
            type: 'post',
            data: {
                taxIdentifiers: JSON.stringify(taxidentifierData.fieldsWithSuccess[customerType])
            },
            success: function (ajaxResponse) {
                if (ajaxResponse.error) {
                    drHelper.checkoutError(ajaxResponse.errorMessage);
                } else if (ajaxResponse.appliedTaxIdentifiers) {
                    taxIdentifier.unmount(); // rerender fields to not have values in it
                    taxIdentifier.mount('tax-id');
                    displayAppliedTaxIdentifiers(ajaxResponse.appliedTaxIdentifiers, ajaxResponse.deleteText);
                    recalculateBasket(ajaxResponse.order);
                    $btnTaxidentifierSubmit.prop('disabled', true);
                }
            },
            error: function (err) {
                drHelper.checkoutError(err.responseJSON.message);
            },
            complete: function () {
                $('#accordionBilling').spinner().stop();
            }
        });
    });

    // delete tax identifier handler
    var $listOfAppliedIdentifiers = $('#dr-list-of-applied-identifiers');
    $listOfAppliedIdentifiers.on('click', '.dr-applied-identifier-delete', function () {
        var appliedIdentifier = $(this).parent();
        $('#accordionBilling').spinner().start();
        var deleteUrl = $listOfAppliedIdentifiers.data('delete-url');
        var identifierId = appliedIdentifier.data('id');
        $.ajax({
            url: deleteUrl,
            type: 'post',
            data: {
                identifierId: identifierId
            },
            success: function (ajaxResponse) {
                if (ajaxResponse.error) {
                    drHelper.checkoutError(ajaxResponse.errorMessage);
                } else if (!ajaxResponse.notUsed) { // no identifier was deleted because of some missing attribute
                    appliedIdentifier.hide();
                    recalculateBasket(ajaxResponse.order);
                }
            },
            error: function (err) {
                drHelper.checkoutError(err.responseJSON.message);
            },
            complete: function () {
                $('#accordionBilling').spinner().stop();
            }
        });
        return false;
    });
}

module.exports = {
    initEvents: initEvents
};
