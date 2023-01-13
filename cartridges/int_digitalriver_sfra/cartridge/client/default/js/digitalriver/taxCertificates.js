'use strict';

var formValidation = require('base/components/formValidation');
var drHelper = require('../checkout/drHelper');

module.exports = {
    submitCertificate: function () {
        $('form.tax-certificate-form').submit(function (e) {
            var $form = $(this);
            e.preventDefault();
            var url = $form.attr('action');
            $form.spinner().start();
            $('tax-certificate-form').trigger('certificate:submit', e);

            // check file extension
            var $certificateErrorMessage = $('.certificate-error-message');
            var files = $('input[name$=_imageFile]', $form).prop('files');
            if (!drHelper.checkAllowedFilesType(files)) {
                var errorMessage = $certificateErrorMessage.data('error-message');
                $('.error-message-text').text(errorMessage);
                $certificateErrorMessage.show();
                $form.spinner().stop();
                return false;
            }
            $certificateErrorMessage.hide();

            var formData = new FormData(this);

            $.ajax({
                url: url,
                contentType: false,
                processData: false,
                method: 'POST',
                data: formData,
                success: function (data) {
                    $form.spinner().stop();
                    if (!data.success) {
                        if (data.errorMessage) {
                            $('.certificate-error-message').show();
                            $('.error-message-text').text(data.errorMessage);
                        } else {
                            formValidation($form, data);
                        }
                    } else {
                        location.href = data.redirectUrl;
                    }
                },
                error: function (err) {
                    $form.spinner().stop();
                    if (err.responseJSON && err.responseJSON.redirectUrl) {
                        window.location.href = err.responseJSON.redirectUrl;
                    }
                }
            });
            return false;
        });
    },
    selectFile: function () {
        $('#imageFile').on('change', function () {
            var $inputField = $(this);
            var fileName = $inputField.val().replace(/.*(\/|\\)/, '');
            $inputField.siblings('.custom-file-label').addClass('selected').html(fileName);
        });
    }
};
