'use strict';

/**
* Initializes the offline refund form and handles the refund process
*/
function initEvents() {
    var $offlineContainer = $('#offlineContainer');
    var DRapiKey;
    var DRLocale;
    var refundTokenNo;
    if ($offlineContainer.length) {
        DRapiKey = $offlineContainer.data('apikey');
        DRLocale = $offlineContainer.data('locale');
        refundTokenNo = $offlineContainer.data('token');
    }
    if (typeof DigitalRiver !== 'undefined') {
        var offlineOptions = {
            classes: {
                base: 'DRElement',
                complete: 'offline-refund-form-complete',
                invalid: 'offline-refund-form-invalid'
            },
            style: {
                base: {
                    color: '#495057',
                    height: '35px',
                    fontSize: '1rem',
                    fontFamily: 'apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif',
                    fontWeight: 'lighter',
                    ':hover': {
                        color: '#ccc'
                    },
                    '::placeholder': {
                        color: '#495057'
                    }
                },
                focus: {
                    ':hover': {
                        color: '#495057'
                    }
                },
                empty: {
                    ':hover': {
                        color: '#495057'
                    }
                },
                complete: {
                    ':hover': {
                        color: '#495057'
                    }
                }
            },
            refundToken: refundTokenNo
        };
        // eslint-disable-next-line no-undef
        let digitalriver = new DigitalRiver(DRapiKey, {
            locale: DRLocale
        });
        let offlineRefund = digitalriver.createElement('offlinerefund', offlineOptions);
        offlineRefund.mount('offline-refund-form');

        offlineRefund.on('change', function (event) {
            if (event.complete) {
                document.getElementById('successMsg').style.display = 'block';
                document.getElementById('welcomeMsg').style.display = 'none';
            } else {
                document.getElementById('successMsg').style.display = 'none';
            }
        });
    }
}

module.exports = {
    initEvents: initEvents
};
