var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');

function updateCookies(cookieJar, requestObj) {
    var cookieString = cookieJar.getCookieString(requestObj.url);
    var cookie = request.cookie(cookieString);
    cookieJar.setCookie(cookie, requestObj.url);
}

describe('Controller TaxCertificates', function () {
    describe('TaxCertificates-SaveCertificate', function () {
        this.timeout(5000);

        it('should forbid non-registered users to save tax certificates', function () {
            var cookieJar = request.jar();
            var myRequest = {
                url: '',
                method: 'POST',
                resolveWithFullResponse: true,
                form: {},
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };
            myRequest.url = config.baseUrl + '/CSRF-Generate';
            return request(myRequest)
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);
                    myRequest.url = config.baseUrl + '/TaxCertificates-SaveCertificate';
                    myRequest.form = {
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (success) {
                    assert.fail(`Not registered user should not receive ${success.statusCode} status code`);
                }).catch(function (reject) {
                    assert.equal(reject.statusCode, 500);
                });
        });
    });

    describe('TaxCertificates-CertificateList', function () {
        this.timeout(5000);

        it('should forbid non-registered users to load tax certificates list', function () {
            var myRequest = {
                url: config.baseUrl + '/TaxCertificates-CertificateList',
                method: 'GET',
                resolveWithFullResponse: true,
                form: {},
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            request(myRequest)
                .then(function (success) {
                    assert.fail(`Not registered user should not receive ${success.statusCode} status code`);
                }).catch(function (reject) {
                    assert.equal(reject.statusCode, 500);
                });
        });
    });
});
