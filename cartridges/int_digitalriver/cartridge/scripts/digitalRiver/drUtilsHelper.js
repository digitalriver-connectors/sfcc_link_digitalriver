'use strict';

var Calendar = require('dw/util/Calendar');
var StringUtils = require('dw/util/StringUtils');

/**
 * Convert string date from Digital River API format to Calendar format
 * @param {string} drDate - string date in Digital River API format
 * @returns {dw.util.Calendar} - Calendar format
 */
function drDateToCalendar(drDate) {
    var dateStr = drDate.replace(/\..*?[Zz]|[Zz]/, '.000Z');
    var dt = new Date(dateStr);
    return new Calendar(dt);
}

/**
 * Convert string date from Digital River API format to local format
 * @param {string} drDate - string date in Digital River API format
 * @returns {string} - string date in local format
 */
function drDateToLocal(drDate) {
    var calendarDate = drDateToCalendar(drDate);
    return StringUtils.formatCalendar(calendarDate, request.getLocale(), Calendar.INPUT_DATE_PATTERN);
}

/**
 * Convert string date from Digital River API format to US format
 * @param {string} drDate - string date in Digital River API format
 * @returns {string} - string date in US format
 */
function drDateToUS(drDate) {
    var calendarDate = drDateToCalendar(drDate);
    return StringUtils.formatCalendar(calendarDate, 'MM/dd/yyyy');
}

/**
 * Creates an error string from the Digital River API error response
 * @param {Object} drResponse - Digital River API response
 * @returns {string} - error message
 */
function getErrorMesseges(drResponse) {
    var result = '';
    if (drResponse && Object.hasOwnProperty.call(drResponse, 'errorMessage')) {
        var drErrors = null;
        try {
            drErrors = JSON.parse(drResponse.errorMessage);
        } catch (error) {
            drErrors = null;
        }
        if (drErrors && drErrors.errors) {
            drErrors.errors.forEach(function (element) {
                result += element.message + ' ';
            });
        }
    }
    return result;
}

module.exports = {
    drDateToLocal: drDateToLocal,
    drDateToUS: drDateToUS,
    getErrorMesseges: getErrorMesseges
};
