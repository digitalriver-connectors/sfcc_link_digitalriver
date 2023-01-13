'use strict';

var summaryHelpers = require('base/checkout/summary');

var output = Object.assign({}, summaryHelpers);

output.updateTotals = function (totals) {
    summaryHelpers.updateTotals(totals);

    if (totals.drTaxDiscountTotal && Math.abs(totals.drTaxDiscountTotal.value) >= 0.01) {
        $('.vat-included-msg').addClass('hidden');
        $('.vat-exempted-msg').removeClass('hidden');
        $('.vat-exempted-value').text(totals.drTaxDiscountTotal.formatted);
    } else {
        $('.vat-included-msg').removeClass('hidden');
        $('.vat-exempted-msg').addClass('hidden');
    }

    if (totals.isImporterOfRecordTax || (totals.duty && totals.duty.value > 0)) {
        $('.duty-item').removeClass('hide-order-discount');
        $('.duty-total').text(totals.duty.formatted);
    } else {
        $('.duty-item').addClass('hide-order-discount');
    }

    if (totals.isImporterOfRecordTax || (totals.importerTax && totals.importerTax.value > 0)) {
        $('.importerTax-item').removeClass('hide-order-discount');
        $('.importerTax-total').text(totals.importerTax.formatted);
    } else {
        $('.importerTax-item').addClass('hide-order-discount');
    }

    if (totals.isImporterOfRecordTax || (totals.totalFees && totals.totalFees.value > 0)) {
        $('.totalFees-item').removeClass('hide-order-discount');
        $('.totalFees-total').text(totals.totalFees.formatted);
    } else {
        $('.totalFees-item').addClass('hide-order-discount');
    }

    if (totals.isZeroTotal) {
        $('.payment-instruments-container').data('payment-method-id', 'DIGITAL_RIVER_ZERO_PAYMENT');
        $('#payment-method-input').val('DIGITAL_RIVER_ZERO_PAYMENT');
        $('#headingPayment').addClass('digitalriver-hide');
        $('.submit-payment').removeClass('digitalriver-hide');
    } else {
        $('.payment-instruments-container').data('payment-method-id', 'DIGITAL_RIVER_DROPIN');
        $('#payment-method-input').val('DIGITAL_RIVER_DROPIN');
        $('#headingPayment').removeClass('digitalriver-hide');
        if (!$('.submit-payment').data('saved-payments')) {
            $('.submit-payment').addClass('digitalriver-hide');
        }
    }
};

module.exports = output;
