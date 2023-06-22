'use strict';

jQuery.noConflict();

/**
 * Test services
 *
 * @param {Object} $ Jquery object
 */
function testServices($) {
    $('.test-service').on('click', function (e) {
        e.preventDefault();
        var url = $('.test-service').data('url');
        $('.sku-result').text('waiting');
        $('.checkout-result').text('waiting');
        $('.customer-result').text('waiting');
        $.ajax({
            url: url,
            success: function (res) {
                $('.sku-result').text(res.response.sku);
                $('.checkout-result').text(res.response.checkout);
                $('.customer-result').text(res.response.customer);
            },
            error: function (res) {
                $('.drbm-error-info').text('Error while testing services: ' + res.status + ' ' + res.statusText);
            }
        });
    });
}

jQuery(document).ready(function ($) { // eslint-disable-line no-undef
    testServices($);
});
