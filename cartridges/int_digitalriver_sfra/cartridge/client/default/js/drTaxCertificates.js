'use strict';

var processInclude = require('base/util');

/*
 * Digital River Tax Certificates
 */
$(document).ready(function () {
    processInclude(require('./digitalriver/taxCertificates'));
});
