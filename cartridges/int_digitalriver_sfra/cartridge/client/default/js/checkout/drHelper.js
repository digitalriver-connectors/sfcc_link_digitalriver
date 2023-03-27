'use strict';

var scrollAnimate = require('base/components/scrollAnimate');

/**
 * Creates html to display Digital River compliance
 * @param {string} element - ID of DOM element
 * @returns {void} generate html
 */
function renderDRCompliance(element) {
    if ($('#' + element).length === 0) {
        return;
    }
    var $dropInContainer = $('#dropInContainer');
    if ($dropInContainer.length) {
        var DRapiKey = $dropInContainer.data('apikey');
        var DRLocale = $dropInContainer.data('locale');
        var siteLocaleInArray = DRLocale.split('-');
        var complianceEntity = $dropInContainer.attr('data-compliance-entity');
        var complianceOptions = {
            classes: {
                base: 'DRElement'
            },
            compliance: {
                country: siteLocaleInArray[1] || '', // 'de' or empty string
                language: siteLocaleInArray[0],
                businessEntityCode: complianceEntity
            }
        };
        // eslint-disable-next-line no-undef
        var digitalRiver = new DigitalRiver(DRapiKey, {
            locale: DRLocale
        });
        var compliance = digitalRiver.createElement('compliance', complianceOptions);
        compliance.mount(element);
    }
}

/**
 * Creates html to display Digital River confirm checkbox
 * @returns {void} generate html
 */
function renderDRConfirm() {
    var $dropInContainer = $('#dropInContainer');
    if ($dropInContainer.length) {
        var DRapiKey = $dropInContainer.data('apikey');
        var DRLocale = $dropInContainer.data('locale');

        // eslint-disable-next-line no-undef
        var digitalRiver = new DigitalRiver(DRapiKey, {
            locale: DRLocale
        });
        var compliance = digitalRiver.Compliance.getDetails(
            $dropInContainer.attr('data-compliance-entity'),
            DRLocale
        );
        var htmlToAppend = '<div class="card-body row">'
            + '<div class="col-12">'
            + '<div class="custom-control custom-checkbox">'
            + '<input class="custom-control-input" type="checkbox" id="dr-cb-confirm" />'
            + '<label for="dr-cb-confirm" class="custom-control-label checkout-checkbox" id="lb-confirm">'
            + compliance.disclosure.confirmDisclosure.localizedText
            + '</label></div></div></div>';
        $('#confirmdisclosure').empty();
        $('#confirmdisclosure').append(htmlToAppend);

        $('#dr-cb-confirm').change(function () {
            if ($(this).prop('checked')) {
                $('body').trigger('checkout:enableButton', '.next-step-button .place-order');
            } else {
                $('body').trigger('checkout:disableButton', '.next-step-button .place-order');
            }
        });

        $('#dr-cb-confirm').trigger('change');
    }
}

/**
 * check SCA for saved card
 * @param {string} storedPaymentUUID - stored credit card uuid
 * @param {Object} defer - deferred object
 * @param {function} placeOrderCallBack - place order callback function
 */
function retrieveStoredCard(storedPaymentUUID, defer, placeOrderCallBack) {
    // $('#drop-in').spinner().start();
    var $dropInContainer = $('#dropInContainer');
    if (storedPaymentUUID && $dropInContainer.length) {
        var DRapiKey = $dropInContainer.data('apikey');
        var DRLocale = $dropInContainer.data('locale');

        // eslint-disable-next-line no-undef
        var digitalRiver = new DigitalRiver(DRapiKey, {
            locale: DRLocale
        });

        var storedCardUrl = $('#drop-in').attr('data-storedcard-url');
        $.ajax({
            url: storedCardUrl,
            type: 'post',
            data: {
                storedPaymentUUID: storedPaymentUUID
            },
            success: function (data) {
                digitalRiver.authenticateSource(data.cardDetails).then(function (authResult) {
                    if (authResult.status === 'failed') {
                        defer.reject({
                            errorMessage: data.errorMessage
                        });
                    } else {
                        placeOrderCallBack(defer);
                    }
                });
            },
            error: function (err) {
                defer.reject(err);
            }
        });
    } else {
        placeOrderCallBack(defer);
    }
}

/**
 * Update DigitalRiver Compliance Entity data attribute and redrow checkout Compliance Entity
 * @param {string} complianceEntity - DigitalRiver Compliance Entity
 */
function updateComplianceEntity(complianceEntity) {
    $('#dropInContainer').attr('data-compliance-entity', complianceEntity);
    renderDRCompliance('checkoutCompliance');
}

/**
 * Displays error message to user
 *
 * @param {string} msg message to be shown
 */
function checkoutError(msg) {
    $('.error-message').show();
    $('.error-message-text').text(msg);
    scrollAnimate($('.error-message'));
}

/**
 * Clear error message to user
 */
function clearError() {
    $('.error-message').hide();
    $('.error-message-text').text('');
}

/**
 * checks for allowed file name extensions in the list
 * @param {FileList} fileList - list of files
 * @returns {boolean} - result of checking
 */
function checkAllowedFilesType(fileList) {
    var allowedFileExt = ['csv', 'jpg', 'jpeg', 'pdf', 'png'];
    for (var i = 0; i < fileList.length; i++) {
        var fileName = fileList[i].name;
        var idx = fileName ? fileName.lastIndexOf('.') : -1;
        var fileExt = idx < 0 ? '' : (fileName.slice(++idx)).toLowerCase();
        if (allowedFileExt.indexOf(fileExt) === -1) return false;
    }
    return true;
}

/** Digital River - 2.6 - Redirect flow logic
 * @param {Object} defer - deferred object
 * @param {function} placeOrderCallBack - place order callback function
 */
function handleDROrderPlacement(defer, placeOrderCallBack) {
    $('.DR-place-order').data('dr-order-placed', false);
    $.ajax({
        url: $('.DR-place-order').data('action'),
        method: 'POST',
        success: function (data) {
            // enable the placeOrder button here
            $('body').trigger('checkout:enableButton', '.next-step-button button');
            if (data.error) {
                $('#checkout-main').spinner().stop();
                if (data.cartError) {
                    window.location.href = data.redirectUrl;
                    defer.reject();
                } else {
                    if (data.digitalRiverConfiguration) {
                        $('body').trigger('digitalRiver:updateDropIn', data.digitalRiverConfiguration);
                    }
                    // go to appropriate stage and display error message
                    defer.reject(data);
                }
            } else {
                //DR order successfully placed. Go back to main place order logic by calling nextStage again
                if(data.placeFinalOrder)
                {
                    $('.DR-place-order').data('dr-order-placed', true);
                    //members.nextStage();
                    placeOrderCallBack(defer);
                }
                else {
                // handle the response
                    var redirect = $('<form>')
                        .appendTo(document.body)
                        .attr({
                            method: 'POST',
                            action: data.continueUrl
                        });

                    $('<input>')
                        .appendTo(redirect)
                        .attr({
                            name: 'orderID',
                            value: data.orderID
                        });

                    $('<input>')
                        .appendTo(redirect)
                        .attr({
                            name: 'orderToken',
                            value: data.orderToken
                        });
                    redirect.submit();
                    defer.resolve();
                    //placeOrderCallBack(defer);
                
                }
                                          
            }
        },
        error: function () {
            // enable the placeOrder button here
            $('body').trigger('checkout:enableButton', $('.next-step-button button'));
        }
    }); 
}

/** Digital River - 2.6 - Redirect flow logic
 * @param {Object} members - used to control checkout flow
 */
function handleDROrderRedirect(members)
{
    if($('.DR-place-order').data('dr-redirect-success'))
    {
        $('.DR-place-order').data('dr-redirect-success',"false");
        $('.DR-place-order').data('dr-order-placed',"true");
        members.gotoStage('placeOrder');
        members.nextStage();
    }
    else if($('.DR-place-order').data('dr-redirect-error'))
    {
        $('.error-message').show();
        members.gotoStage('payment');
    }
}


module.exports = {
    renderDRConfirm: renderDRConfirm,
    renderDRCompliance: renderDRCompliance,
    retrieveStoredCard: retrieveStoredCard,
    updateComplianceEntity: updateComplianceEntity,
    checkoutError: checkoutError,
    clearError: clearError,
    checkAllowedFilesType: checkAllowedFilesType,
    handleDROrderPlacement: handleDROrderPlacement,
    handleDROrderRedirect: handleDROrderRedirect
};
