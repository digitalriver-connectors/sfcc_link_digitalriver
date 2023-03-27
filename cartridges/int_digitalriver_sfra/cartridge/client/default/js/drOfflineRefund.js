'use strict';

var processInclude = require('base/util');
/*
 * Digital River Offline refund form
 */
$(document).ready(function () {
    processInclude(require('./digitalriver/offlineRefund'));
});
