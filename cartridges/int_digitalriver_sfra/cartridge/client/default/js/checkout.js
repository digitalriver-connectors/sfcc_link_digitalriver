'use strict';

var processInclude = require('base/util');

$(document).ready(function () {
    processInclude(require('./checkout/checkout'));
    processInclude(require('./checkout/drDropIn'));
    processInclude(require('./checkout/drCertificate'));
    processInclude(require('./checkout/drTaxId'));
});
