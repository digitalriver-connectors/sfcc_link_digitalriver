'use strict';

var parent = module.superModule;
var output = {};
Object.keys(parent).forEach(function (key) {
    output[key] = parent[key];
});

/*
    @IG:
    Modify this function depending on your implementation of multiple payment instruments support
*/
output.calculatePaymentTransaction = function (currentBasket) {
    var result = { error: false };

    try {
        var paymentInstruments = currentBasket.paymentInstruments;

        if (!paymentInstruments.length) {
            return;
        }
    } catch (e) {
        result.error = true;
    }

    return result; // eslint-disable-line consistent-return
};

module.exports = output;
