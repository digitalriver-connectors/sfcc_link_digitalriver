'use strict';

var $mainContainer = $('#invoice-credit');
var loadingText = $mainContainer.data('loading-text');
var loadingErrorText = $mainContainer.data('loading-error-text');
var baseUrl = $mainContainer.data('url');
var chunkSize = 6;

/**
 * appends params to a url
 * @param {string} url - Original url
 * @param {Object} params - Parameters to append
 * @returns {string} result url with appended parameters
 */
function appendToUrl(url, params) {
    var newUrl = url;
    newUrl += (newUrl.indexOf('?') !== -1 ? '&' : '?') + Object.keys(params).map(function (key) {
        return key + '=' + encodeURIComponent(params[key]);
    }).join('&');

    return newUrl;
}

/**
 * Displays invoice/credit memo file links
 * @param {Array} fileLinks array of file link objects
 * @param {Object} $fileLinksContainer container for displaying invoice/credit memo file links
 * @returns {void}
 */
function displayFileLinks(fileLinks, $fileLinksContainer) {
    var fileLabel = $fileLinksContainer.data('file-label');
    var fileLinksHtml = '<ul>';
    for (var i = 0; i < fileLinks.length; i += 1) {
        var fileLink = fileLinks[i];
        fileLinksHtml += '<li><a href="' + fileLink.url + '">';
        fileLinksHtml += fileLabel + ' ' + fileLink.id;
        fileLinksHtml += '</a></li>';
    }
    fileLinksHtml += '</ul>';
    $fileLinksContainer.html(fileLinksHtml);
}

/**
 * Makes ajax calls in order to load invoice/credit memo file links
 * @param {Object} $fileLinksContainer container for displaying invoice/credit memo file links
 * @returns {void}
 */
function loadFileLinks($fileLinksContainer) {
    if ($fileLinksContainer.length) {
        $fileLinksContainer.html(loadingText);
        var fileIds = $fileLinksContainer.data('files').split(',');
        var ajaxCalls = [];
        var fileLinks = [];

        for (var i = 0; i < fileIds.length; i += chunkSize) {
            var fileIdsChunk = fileIds.slice(i, i + chunkSize);
            var url = appendToUrl(baseUrl, { ids: fileIdsChunk.join() });
            ajaxCalls.push(
                $.ajax({
                    url: url,
                    success: function (data) { // eslint-disable-line no-loop-func
                        fileLinks = fileLinks.concat(data.fileLinks);
                    }
                })
            );
        }

        $.when.apply($, ajaxCalls)
            .done(function () {
                if (fileLinks.length) {
                    displayFileLinks(fileLinks, $fileLinksContainer);
                } else {
                    $fileLinksContainer.html(loadingErrorText);
                }
            })
            .fail(function () {
                $fileLinksContainer.html(loadingErrorText);
            });
    }
}

/**
 * Initiates events listener
 * @returns {void}
 */
function initEvents() {
    $(document).ready(function () {
        loadFileLinks($('#invoiceLinks'));
        loadFileLinks($('#creditMemoLinks'));
    });
}
module.exports = {
    initEvents: initEvents
};
