'use strict';

function initEvents() {
    var $offlineContainer = $('#offlineContainer');
    if ($offlineContainer.length) {
        var DRapiKey = $offlineContainer.data('apikey');
        var DRLocale = $offlineContainer.data('locale');
        var refundTokenNo = $offlineContainer.data('token');
    }
    if (typeof DigitalRiver !== 'undefined') {
         var offlineOptions = {
        classes: {
            base: "DRElement",
            complete: "offline-refund-form-complete",
            invalid: "offline-refund-form-invalid"
        },
        style: {
            base: {
                color: '#495057',
                height: '35px',
                fontSize: '1rem',
                fontFamily: 'apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif',
                fontWeight: 'lighter',
                ':hover': {
                    color: '#ccc',
                },
                '::placeholder': {
                    color: '#495057'
                }
            },
            focus: {
                ':hover': {
                    color: '#495057',
                }, 
            },
            empty: {
                ':hover': {
                    color: '#495057',
                },
            },
            complete: {
                ':hover': {
                    color: '#495057',
                },
            }
        },
        refundToken: refundTokenNo
    };
    let digitalriver = new DigitalRiver(DRapiKey, {
        locale: DRLocale
    });
    let offlineRefund = digitalriver.createElement('offlinerefund', offlineOptions);
    offlineRefund.mount('offline-refund-form');
    
    offlineRefund.on('change', function(event) {
        if(event.complete) {
            document.getElementById('successMsg').style.display='block';
            document.getElementById('welcomeMsg').style.display='none';
        }
        else {
            document.getElementById('successMsg').style.display='none';
        }
    });
    }
}

module.exports = {
    initEvents: initEvents
};

