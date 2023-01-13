'use strict';

var processInclude = require('base/util');

$(document).ready(function () {
    processInclude(require('base/paymentInstruments/paymentInstruments'));
    processInclude(require('./paymentInstruments/paymentInstrumentsDropIn'));
});
