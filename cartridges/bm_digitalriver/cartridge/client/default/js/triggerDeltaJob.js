'use strict';

jQuery.noConflict();

/**
 * Append parameters to url
 *
 * @param {string} url
 * @param {Object} params url parameters
 * @returns {string}
 */
function appendToUrl(url, params) {
    var newUrl = url;
    newUrl += (newUrl.indexOf('?') !== -1 ? '&' : '?') + Object.keys(params).map(function (key) {
        return key + '=' + encodeURIComponent(params[key]);
    }).join('&');

    return newUrl;
}

/**
 * Trigger scheduledJob
 *
 * @param {Object} $ Jquery object
 */
function triggerJob($) {
    $('.drbm-trigger-button').on('click', function (e) {
        var triggerJobButton = $(this);
        e.preventDefault();
        var url = triggerJobButton.data('url');
        var urlParams = {
            actionMessage: triggerJobButton.text().trim()
        };
        url = appendToUrl(url, urlParams);
        $.ajax({
            url: url,
            type: 'get',
            dataType: 'json',
            success: function (res) {
                triggerJobButton.text(res.actionMessage);
            }
        });
    });
}

jQuery(document).ready(function ($) {
    triggerJob($);
});
