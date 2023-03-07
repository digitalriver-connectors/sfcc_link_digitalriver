'use strict';

var drHelper = require('dr_sfra/checkout/drHelper');
var output = Object.assign({}, drHelper);

output.updateCustomerCreditTotal = function (adjustedGrandTotal, customerCreditSources) {
    if (adjustedGrandTotal && adjustedGrandTotal.customerCreditTotal.value > 0) {
        $('.customerCredit-block').removeClass('hide-order-discount');
        $('.customerCredit-total').empty().append(adjustedGrandTotal.customerCreditTotal.formatted);
        $('.grand-total-sum-adjusted').empty().append(adjustedGrandTotal.formatted);
    } else {
        $('.customerCredit-block').addClass('hide-order-discount');
    }
    if (customerCreditSources && customerCreditSources.length > 0) {
        var htmlGiftToAppend = '';
        /*
            @IG:
            Modify labelCustomerCredit value with the value you want to be displayed on the UI
        */
        var labelCustomerCredit = $('#dr-list-of-applied-customercredits').data('payment-info-text');
        for (var i = 0; i < customerCreditSources.length; i++) {
            htmlGiftToAppend += '<div class="col-6 start-lines">'
                + '<span class="order-receipt-label">' + labelCustomerCredit + ' ' + (i + 1) + '</span>'
                + '</div><div class="col-6 end-lines">'
                + '<div class="text-right">'
                + '<span>' + customerCreditSources[i].formatted + '</span></div></div>';
        }
        $('.payment-details').empty().append('<div class="row leading-lines">' + htmlGiftToAppend + '</div>');
    }
};

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

module.exports = output;
module.export = {
    handleDROrderPlacement: handleDROrderPlacement,
    handleDROrderRedirect: handleDROrderRedirect,
    retrieveStoredCard: retrieveStoredCard
}