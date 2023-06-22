var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');

describe('Controller Cart', function () {
    describe('Cart-Show', function () {
        this.timeout(3000);

        it('should return json with error data but without errorStage property', function () {
            var myRequest = {
                url: config.baseUrl + '/Cart-Show',
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
                });
        });
    });
});
