var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');

describe('Controller CheckoutServices', function () {
    describe('CheckoutServices-PlaceOrder', function () {
        this.timeout(3000);

        it('should return json with error data but without errorStage property', function () {
            var myRequest = {
                url: config.baseUrl + '/CheckoutServices-PlaceOrder',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };
            return request(myRequest)
                .then(function (response) {
                    assert.equal(response.statusCode, 200);
                    var bodyAsJson = JSON.parse(response.body);
                    assert.isTrue(bodyAsJson.error);
                    assert.notExists(bodyAsJson.errorStage);
                });
        });
    });
});
