'use strict';

/**
 * Module for logging Digital River API requests/responses
 */
var Logger = require('dw/system/Logger');
var DIGITAL_RIVER_LOG_NAME = 'DigitalRiver';

module.exports = {
    getLogger: function (loggingCategory) { return Logger.getLogger(DIGITAL_RIVER_LOG_NAME, loggingCategory); }
};
