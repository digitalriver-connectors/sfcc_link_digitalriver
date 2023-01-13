'use strict';

/**
 * @description Zero payment form processor
 */

/**
 * @description Verifies the required information for billing form is provided.
 * @param {Object} req - The request object
 * @param {Object} paymentForm - Payment form
 * @param {Object} viewFormData - Object contains billing form data
 * @returns {Object} An object that has error  or payment information
 */
function processForm(req, paymentForm, viewFormData) {
    var viewData = viewFormData;

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    return {
        error: false,
        viewData: viewData
    };
}

exports.processForm = processForm;
