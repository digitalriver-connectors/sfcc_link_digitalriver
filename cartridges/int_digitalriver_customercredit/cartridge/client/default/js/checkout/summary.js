'use strict';

var summaryHelpers = require('dr_sfra/checkout/summary');
var drHelper = require('./drHelper.js');

var output = Object.assign({}, summaryHelpers);

output.updateTotals = function (totals) {
    summaryHelpers.updateTotals(totals);
    drHelper.updateCustomerCreditTotal(totals.adjustedGrandTotal);
};

module.exports = output;
