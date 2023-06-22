var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');

function updateCookies(cookieJar, requestObj) {
    var cookieString = cookieJar.getCookieString(requestObj.url);
    var cookie = request.cookie(cookieString);
    cookieJar.setCookie(cookie, requestObj.url);
}

describe('Controller DigitalRiver', function () {
    describe('DigitalRiver-SubmitDropInConfigForm', function () {
        this.timeout(5000);

        it('should return configuration for mounting Digital River drop-in', function () {
            var cookieJar = request.jar();

            var myRequest = {
                url: config.baseUrl + '',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            // Step 1: Get CSRF token
            myRequest.url = config.baseUrl + '/CSRF-Generate';
            return request(myRequest)
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token before log in');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);

                    // Step 2: Send form to get configuration
                    myRequest.url = config.baseUrl + '/DigitalRiver-SubmitDropInConfigForm';
                    myRequest.form = {
                        dwfrm_billing_addressFields_addressId: 'Test_address_id',
                        dwfrm_billing_addressFields_firstName: 'Test_fitst_name',
                        dwfrm_billing_addressFields_lastName: 'Test_last_name',
                        dwfrm_billing_addressFields_address1: '2782  College View',
                        dwfrm_billing_addressFields_address2: '',
                        dwfrm_billing_addressFields_city: 'Mascoutah',
                        dwfrm_billing_addressFields_postalCode: '62258',
                        dwfrm_billing_addressFields_country: 'US',
                        dwfrm_billing_addressFields_states_stateCode: 'IL',
                        dwfrm_billing_contactInfoFields_phone: '847-921-8135',
                        dwfrm_coCustomer_email: 'test.email@mail.com',
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected statusCode to be 200.');
                    var bodyAsJson = JSON.parse(response.body);
                    var dropInConfiguration = {
                        billingAddress: {
                            firstName: 'Test_fitst_name',
                            lastName: 'Test_last_name',
                            email: 'test.email@mail.com',
                            phoneNumber: '847-921-8135',
                            address: {
                                line1: '2782  College View',
                                line2: null,
                                country: 'US',
                                state: 'IL',
                                city: 'Mascoutah',
                                postalCode: '62258'
                            }
                        }
                    };

                    assert.deepOwnInclude(bodyAsJson.dropInConfiguration, dropInConfiguration);
                });
        });
    });

    describe('DigitalRiver-SubmitPayment', function () {
        this.timeout(10000);

        it('should return json with payment information', function () {
            var cookieJar = request.jar();

            var myRequest = {
                url: '',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            var variantPid1 = '701644033675M';
            var qty1 = 2;
            var addProd = '/Cart-AddProduct';

            // Step 1: adding product to Cart
            myRequest.url = config.baseUrl + addProd;
            myRequest.form = {
                pid: variantPid1,
                quantity: qty1
            };

            return request(myRequest)
                .then(function (addToCartResponse) {
                    assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                    // Step 2: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token before log in');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);
                    // Step 3: Added guest customer
                    myRequest.url = config.baseUrl + '/CheckoutServices-SubmitCustomer';
                    myRequest.form = {
                        dwfrm_coCustomer_email: 'test.email@mail.com',
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (submitCustomerResponse) {
                    assert.equal(submitCustomerResponse.statusCode, 200, 'Expected added guest customer call to return status code 200');
                    // Step 4: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (csrfResponse) {
                    var csrfJsonResponse = JSON.parse(csrfResponse.body);
                    // Step 5 : submit shipping request to update basket with necessary custom data
                    myRequest.url = config.baseUrl + '/CheckoutShippingServices-SubmitShipping?';

                    myRequest.form = {
                        originalShipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentSelector: 'new',
                        dwfrm_shipping_shippingAddress_addressFields_firstName: 'Tyler',
                        dwfrm_shipping_shippingAddress_addressFields_lastName: 'Durden',
                        dwfrm_shipping_shippingAddress_addressFields_address1: '2495 Midway Rd',
                        dwfrm_shipping_shippingAddress_addressFields_address2: '',
                        dwfrm_shipping_shippingAddress_addressFields_country: 'US',
                        dwfrm_shipping_shippingAddress_addressFields_states_stateCode: 'TX',
                        dwfrm_shipping_shippingAddress_addressFields_city: 'Carrollton',
                        dwfrm_shipping_shippingAddress_addressFields_postalCode: '75006-2503',
                        dwfrm_shipping_shippingAddress_addressFields_phone: '8554233729',
                        dwfrm_shipping_shippingAddress_shippingMethodID: 1,
                        dwfrm_shipping_shippingAddress_giftMessage: '',
                        csrf_token: csrfJsonResponse.csrf.token
                    };

                    return request(myRequest);
                })
                .then(function (submitShippingResponse) {
                    assert.equal(submitShippingResponse.statusCode, 200, 'Expected getnerate token call to return status code 200');
                    // Step 6: update cookies, submit payment
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/DigitalRiver-SubmitPayment';
                    var bodyAsJson = JSON.parse(submitShippingResponse.body);
                    myRequest.form = {
                        drData: JSON.stringify({
                            'id': 'some-source-id-12345',
                            'sessionId': bodyAsJson.digitalRiverConfiguration.dropInConfiguration.sessionId,
                            'type': 'creditCard',
                            'amount': '56.28',
                            'currency': 'USD',
                            'creditCard': {
                                'brand': 'Visa',
                                'expirationMonth': 12,
                                'expirationYear': 2023,
                                'lastFourDigits': '1111'
                            }
                        })
                    };
                    return request(myRequest);
                })
                .then(function (response) {
                    var bodyAsJson = JSON.parse(response.body);
                    var expectedResponse = {
                        'error': false,
                        'dropInSummary': {
                            'isCC': true,
                            'type': 'creditCard',
                            'details': {
                                'brand': 'Visa',
                                'expirationMonth': 12,
                                'expirationYear': 2023,
                                'lastFourDigits': '1111',
                                'maskedCreditCardNumber': '************1111'
                            }
                        }
                    };
                    assert.isFalse(bodyAsJson.error);
                    assert.deepOwnInclude(bodyAsJson.dropInSummary, expectedResponse.dropInSummary, 'Expecting actual response dropInSummary to be equal match expected response dropInSummary');
                });
        });
    });

    describe('DigitalRiver-DropInConfig', function () {
        this.timeout(10000);

        it('should return configuration for mounting Digital River Drop-in', function () {
            var cookieJar = request.jar();

            var myRequest = {
                url: '',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            var variantPid1 = '701644033675M';
            var qty1 = 2;
            var addProd = '/Cart-AddProduct';

            // Step 1 adding product to Cart
            myRequest.url = config.baseUrl + addProd;
            myRequest.form = {
                pid: variantPid1,
                quantity: qty1
            };

            var drPaymentSession;

            return request(myRequest)
                .then(function (addToCartResponse) {
                    assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                    // Step 2: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token before log in');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);
                    // Step 3: Added guest customer
                    myRequest.url = config.baseUrl + '/CheckoutServices-SubmitCustomer';
                    myRequest.form = {
                        dwfrm_coCustomer_email: 'test.email@mail.com',
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (submitCustomerResponse) {
                    assert.equal(submitCustomerResponse.statusCode, 200, 'Expected added guest customer call to return status code 200');
                    // Step 4: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (csrfResponse) {
                    var csrfJsonResponse = JSON.parse(csrfResponse.body);
                    // Step 5: submit shipping request to update basket with necessary custom data
                    myRequest.url = config.baseUrl + '/CheckoutShippingServices-SubmitShipping?';

                    myRequest.form = {
                        originalShipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentSelector: 'new',
                        dwfrm_shipping_shippingAddress_addressFields_firstName: 'Tyler',
                        dwfrm_shipping_shippingAddress_addressFields_lastName: 'Durden',
                        dwfrm_shipping_shippingAddress_addressFields_address1: '2495 Midway Rd',
                        dwfrm_shipping_shippingAddress_addressFields_address2: '',
                        dwfrm_shipping_shippingAddress_addressFields_country: 'US',
                        dwfrm_shipping_shippingAddress_addressFields_states_stateCode: 'TX',
                        dwfrm_shipping_shippingAddress_addressFields_city: 'Carrollton',
                        dwfrm_shipping_shippingAddress_addressFields_postalCode: '75006-2503',
                        dwfrm_shipping_shippingAddress_addressFields_phone: '8554233729',
                        dwfrm_shipping_shippingAddress_shippingMethodID: 1,
                        dwfrm_shipping_shippingAddress_giftMessage: '',
                        csrf_token: csrfJsonResponse.csrf.token
                    };

                    return request(myRequest);
                })
                .then(function (submitShippingResponse) {
                    assert.equal(submitShippingResponse.statusCode, 200, 'Expected submit shipping call to return status code 200');
                    // Step 6: update cookies, get DropInConfig
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/DigitalRiver-DropInConfig';
                    myRequest.method = 'GET';
                    myRequest.form = null;
                    drPaymentSession = JSON.parse(submitShippingResponse.body).digitalRiverConfiguration.dropInConfiguration.sessionId;
                    return request(myRequest);
                })
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected DropInConfig call to return status code 200');
                    var bodyAsJson = JSON.parse(response.body);
                    var expectedOutput = {
                        action: 'DigitalRiver-DropInConfig',
                        queryString: '',
                        locale: bodyAsJson.locale,
                        currentLocaleId: bodyAsJson.currentLocaleId,
                        dropInConfiguration: {
                            sessionId: drPaymentSession,
                            options: {
                                showSavePaymentAgreement: false
                            }
                        }
                    };
                    assert.deepOwnInclude(bodyAsJson, expectedOutput);
                });
        });
    });

    describe('DigitalRiver-LogMessage', function () {
        this.timeout(3000);

        it('should return json success true', function () {
            var myRequest = {
                url: config.baseUrl + '/DigitalRiver-LogMessage',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                form: {
                    message: 'test message'
                },
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };
            return request(myRequest)
                .then(function (response) {
                    assert.equal(response.statusCode, 200);
                    var bodyAsJson = JSON.parse(response.body);
                    assert.isTrue(bodyAsJson.success);
                });
        });
    });

    describe('DigitalRiver-TaxIdentifierConfig', function () {
        this.timeout(10000);

        it('should return configuration of Tax Identifier', function () {
            var cookieJar = request.jar();

            var myRequest = {
                url: '',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            var variantPid1 = '701644033675M';
            var qty1 = 2;
            var addProd = '/Cart-AddProduct';

            // Step 1 adding product to Cart
            myRequest.url = config.baseUrl + addProd;
            myRequest.form = {
                pid: variantPid1,
                quantity: qty1
            };

            return request(myRequest)
                .then(function (addToCartResponse) {
                    assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                    // Step 2: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token before log in');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);
                    // Step 3: Added guest customer
                    myRequest.url = config.baseUrl + '/CheckoutServices-SubmitCustomer';
                    myRequest.form = {
                        dwfrm_coCustomer_email: 'test.email@mail.com',
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (submitCustomerResponse) {
                    assert.equal(submitCustomerResponse.statusCode, 200, 'Expected added guest customer call to return status code 200');
                    // Step 4: Tax Identifier сonfig data
                    myRequest.url = config.baseUrl + '/DigitalRiver-TaxIdentifierConfig';
                    myRequest.method = 'GET';
                    return request(myRequest);
                })
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected Tax Identifier call to return status code 200');
                    var bodyAsJson = JSON.parse(response.body);
                    var expectedOutput = {
                        action: 'DigitalRiver-TaxIdentifierConfig',
                        queryString: '',
                        locale: bodyAsJson.locale,
                        currentLocaleId: bodyAsJson.currentLocaleId
                    };
                    assert.deepOwnInclude(bodyAsJson, expectedOutput);
                    assert.isObject(bodyAsJson.order);
                });
        });
    });

    describe('DigitalRiver-TaxIdentifierApply', function () {
        this.timeout(10000);

        it('should return configuration with added Digital River TaxIdentifier', function () {
            var cookieJar = request.jar();

            var myRequest = {
                url: '',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            var variantPid1 = '701644033675M';
            var qty1 = 2;
            var addProd = '/Cart-AddProduct';

            // Step 1 adding product to Cart
            myRequest.url = config.baseUrl + addProd;
            myRequest.form = {
                pid: variantPid1,
                quantity: qty1
            };

            return request(myRequest)
                .then(function (addToCartResponse) {
                    assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                    // Step 2: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token before log in');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);
                    // Step 3: Added guest customer
                    myRequest.url = config.baseUrl + '/CheckoutServices-SubmitCustomer';
                    myRequest.form = {
                        dwfrm_coCustomer_email: 'test.email@mail.com',
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (submitCustomerResponse) {
                    assert.equal(submitCustomerResponse.statusCode, 200, 'Expected added guest customer call to return status code 200');
                    // Step 4: Apply Tax Identifier
                    myRequest.url = config.baseUrl + '/DigitalRiver-TaxIdentifierApply';
                    myRequest.form = {
                        taxIdentifiers: JSON.stringify({
                            value: 'IT11223433',
                            type: 'it_natural',
                            customerType: 'individual'
                        })
                    };
                    return request(myRequest);
                })
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected Tax Identifier call to return status code 200');
                    var bodyAsJson = JSON.parse(response.body);
                    assert.isObject(bodyAsJson.order);
                });
        });
    });

    describe('DigitalRiver-TaxIdentifierDelete', function () {
        this.timeout(10000);

        it('should return successful result of delete Digital River TaxIdentifier', function () {
            var cookieJar = request.jar();

            var myRequest = {
                url: '',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            var variantPid1 = '701644033675M';
            var qty1 = 2;
            var addProd = '/Cart-AddProduct';

            // Step 1 adding product to Cart
            myRequest.url = config.baseUrl + addProd;
            myRequest.form = {
                pid: variantPid1,
                quantity: qty1
            };

            return request(myRequest)
                .then(function (addToCartResponse) {
                    assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                    // Step 2: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token before log in');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);
                    // Step 3: Added guest customer
                    myRequest.url = config.baseUrl + '/CheckoutServices-SubmitCustomer';
                    myRequest.form = {
                        dwfrm_coCustomer_email: 'test.email@mail.com',
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (submitCustomerResponse) {
                    assert.equal(submitCustomerResponse.statusCode, 200, 'Expected added guest customer call to return status code 200');
                    // Step 4: Apply Tax Identifier
                    myRequest.url = config.baseUrl + '/DigitalRiver-TaxIdentifierDelete';
                    myRequest.form = {
                        identifierId: '5774321009'
                    };
                    return request(myRequest);
                })
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected Tax Identifier call to return status code 200');
                    var bodyAsJson = JSON.parse(response.body);
                    assert.isObject(bodyAsJson.order);
                });
        });
    });

    describe('DigitalRiver-StoredCards', function () {
        this.timeout(10000);

        it('should return list of Digital River stored cards', function () {
            var cookieJar = request.jar();

            var myRequest = {
                url: '',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            // Step 1: get cookies, Generate CSRF, then set cookies
            updateCookies(cookieJar, myRequest);
            myRequest.url = config.baseUrl + '/CSRF-Generate';

            return request(myRequest)
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token before log in');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);
                    // Step 2: Added guest customer
                    myRequest.url = config.baseUrl + '/CheckoutServices-SubmitCustomer';
                    myRequest.form = {
                        dwfrm_coCustomer_email: 'test.email@mail.com',
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (submitCustomerResponse) {
                    assert.equal(submitCustomerResponse.statusCode, 200, 'Expected added guest customer call to return status code 200');
                    // Step 4: Apply Tax Identifier
                    myRequest.url = config.baseUrl + '/DigitalRiver-StoredCards';
                    return request(myRequest);
                })
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected Tax Identifier call to return status code 200');
                    var bodyAsJson = JSON.parse(response.body);
                    var expectedOutput = {
                        action: 'DigitalRiver-StoredCards',
                        queryString: '',
                        locale: bodyAsJson.locale,
                        cardDetails: bodyAsJson.cardDetails,
                        errorMessage: 'Strong Customer Authentication error'
                    };
                    assert.deepOwnInclude(bodyAsJson, expectedOutput);
                });
        });
    });

    describe('DigitalRiver-AddCustomerCredit', function () {
        this.timeout(10000);

        it('should return successful result of addding customer credit', function () {
            var cookieJar = request.jar();

            var myRequest = {
                url: '',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            var variantPid1 = '701644033675M';
            var qty1 = 2;
            var addProd = '/Cart-AddProduct';

            // Step 1 adding product to Cart
            myRequest.url = config.baseUrl + addProd;
            myRequest.form = {
                pid: variantPid1,
                quantity: qty1
            };

            return request(myRequest)
                .then(function (addToCartResponse) {
                    assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                    // Step 2: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token before log in');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);
                    // Step 3: Added guest customer
                    myRequest.url = config.baseUrl + '/CheckoutServices-SubmitCustomer';
                    myRequest.form = {
                        dwfrm_coCustomer_email: 'test.email@mail.com',
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (submitCustomerResponse) {
                    assert.equal(submitCustomerResponse.statusCode, 200, 'Expected added guest customer call to return status code 200');
                    // Step 4: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (csrfResponse) {
                    var csrfJsonResponse = JSON.parse(csrfResponse.body);
                    // Step 5: submit shipping request to update basket with necessary custom data
                    myRequest.url = config.baseUrl + '/CheckoutShippingServices-SubmitShipping?';

                    myRequest.form = {
                        originalShipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentSelector: 'new',
                        dwfrm_shipping_shippingAddress_addressFields_firstName: 'Tyler',
                        dwfrm_shipping_shippingAddress_addressFields_lastName: 'Durden',
                        dwfrm_shipping_shippingAddress_addressFields_address1: '2495 Midway Rd',
                        dwfrm_shipping_shippingAddress_addressFields_address2: '',
                        dwfrm_shipping_shippingAddress_addressFields_country: 'US',
                        dwfrm_shipping_shippingAddress_addressFields_states_stateCode: 'TX',
                        dwfrm_shipping_shippingAddress_addressFields_city: 'Carrollton',
                        dwfrm_shipping_shippingAddress_addressFields_postalCode: '75006-2503',
                        dwfrm_shipping_shippingAddress_addressFields_phone: '8554233729',
                        dwfrm_shipping_shippingAddress_shippingMethodID: 1,
                        dwfrm_shipping_shippingAddress_giftMessage: '',
                        csrf_token: csrfJsonResponse.csrf.token
                    };

                    return request(myRequest);
                })
                .then(function (submitShippingResponse) {
                    assert.equal(submitShippingResponse.statusCode, 200, 'Expected submit shipping call to return status code 200');
                    // Step 6: update cookies, make request to add customer credit
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/DigitalRiver-AddCustomerCredit';
                    myRequest.method = 'POST';
                    myRequest.form = {
                        customerCreditAmount: 10
                    };
                    return request(myRequest);
                })
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected AddCustomerCredit call to return status code 200');
                    var bodyAsJson = JSON.parse(response.body);
                    assert.isTrue(bodyAsJson.success);
                    assert.equal(bodyAsJson.customerCreditSources[0].amount, 10);
                    assert.isNumber(bodyAsJson.amountRemainingToBeContributed);
                });
        });
    });

    describe('DigitalRiver-RemoveCustomerCredit', function () {
        this.timeout(10000);

        it('should return result with error for invalid customer credit source ID', function () {
            var cookieJar = request.jar();

            var myRequest = {
                url: '',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            var variantPid1 = '701644033675M';
            var qty1 = 2;
            var addProd = '/Cart-AddProduct';

            // Step 1 adding product to Cart
            myRequest.url = config.baseUrl + addProd;
            myRequest.form = {
                pid: variantPid1,
                quantity: qty1
            };

            return request(myRequest)
                .then(function (addToCartResponse) {
                    assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                    // Step 2: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token before log in');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);
                    // Step 3: Added guest customer
                    myRequest.url = config.baseUrl + '/CheckoutServices-SubmitCustomer';
                    myRequest.form = {
                        dwfrm_coCustomer_email: 'test.email@mail.com',
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (submitCustomerResponse) {
                    assert.equal(submitCustomerResponse.statusCode, 200, 'Expected added guest customer call to return status code 200');
                    // Step 4: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (csrfResponse) {
                    var csrfJsonResponse = JSON.parse(csrfResponse.body);
                    // Step 5: submit shipping request to update basket with necessary custom data
                    myRequest.url = config.baseUrl + '/CheckoutShippingServices-SubmitShipping?';

                    myRequest.form = {
                        originalShipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentSelector: 'new',
                        dwfrm_shipping_shippingAddress_addressFields_firstName: 'Tyler',
                        dwfrm_shipping_shippingAddress_addressFields_lastName: 'Durden',
                        dwfrm_shipping_shippingAddress_addressFields_address1: '2495 Midway Rd',
                        dwfrm_shipping_shippingAddress_addressFields_address2: '',
                        dwfrm_shipping_shippingAddress_addressFields_country: 'US',
                        dwfrm_shipping_shippingAddress_addressFields_states_stateCode: 'TX',
                        dwfrm_shipping_shippingAddress_addressFields_city: 'Carrollton',
                        dwfrm_shipping_shippingAddress_addressFields_postalCode: '75006-2503',
                        dwfrm_shipping_shippingAddress_addressFields_phone: '8554233729',
                        dwfrm_shipping_shippingAddress_shippingMethodID: 1,
                        dwfrm_shipping_shippingAddress_giftMessage: '',
                        csrf_token: csrfJsonResponse.csrf.token
                    };

                    return request(myRequest);
                })
                .then(function (submitShippingResponse) {
                    assert.equal(submitShippingResponse.statusCode, 200, 'Expected submit shipping call to return status code 200');
                    // Step 6: update cookies, make request to remove customer credit source
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/DigitalRiver-RemoveCustomerCredit';
                    myRequest.method = 'POST';
                    myRequest.form = {
                        sourceId: 'someId'
                    };
                    return request(myRequest);
                })
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected RemoveCustomerCredit call to return status code 200');
                    var bodyAsJson = JSON.parse(response.body);
                    assert.isTrue(bodyAsJson.error);
                });
        });
    });

    describe('DigitalRiver-CustomerCredits', function () {
        this.timeout(10000);

        it('should return customer credit sources', function () {
            var cookieJar = request.jar();

            var myRequest = {
                url: '',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            var variantPid1 = '701644033675M';
            var qty1 = 2;
            var addProd = '/Cart-AddProduct';

            // Step 1 adding product to Cart
            myRequest.url = config.baseUrl + addProd;
            myRequest.form = {
                pid: variantPid1,
                quantity: qty1
            };

            return request(myRequest)
                .then(function (addToCartResponse) {
                    assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                    // Step 2: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token before log in');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);
                    // Step 3: Added guest customer
                    myRequest.url = config.baseUrl + '/CheckoutServices-SubmitCustomer';
                    myRequest.form = {
                        dwfrm_coCustomer_email: 'test.email@mail.com',
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (submitCustomerResponse) {
                    assert.equal(submitCustomerResponse.statusCode, 200, 'Expected added guest customer call to return status code 200');
                    // Step 4: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (csrfResponse) {
                    var csrfJsonResponse = JSON.parse(csrfResponse.body);
                    // Step 5: submit shipping request to update basket with necessary custom data
                    myRequest.url = config.baseUrl + '/CheckoutShippingServices-SubmitShipping?';

                    myRequest.form = {
                        originalShipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentSelector: 'new',
                        dwfrm_shipping_shippingAddress_addressFields_firstName: 'Tyler',
                        dwfrm_shipping_shippingAddress_addressFields_lastName: 'Durden',
                        dwfrm_shipping_shippingAddress_addressFields_address1: '2495 Midway Rd',
                        dwfrm_shipping_shippingAddress_addressFields_address2: '',
                        dwfrm_shipping_shippingAddress_addressFields_country: 'US',
                        dwfrm_shipping_shippingAddress_addressFields_states_stateCode: 'TX',
                        dwfrm_shipping_shippingAddress_addressFields_city: 'Carrollton',
                        dwfrm_shipping_shippingAddress_addressFields_postalCode: '75006-2503',
                        dwfrm_shipping_shippingAddress_addressFields_phone: '8554233729',
                        dwfrm_shipping_shippingAddress_shippingMethodID: 1,
                        dwfrm_shipping_shippingAddress_giftMessage: '',
                        csrf_token: csrfJsonResponse.csrf.token
                    };

                    return request(myRequest);
                })
                .then(function (submitShippingResponse) {
                    assert.equal(submitShippingResponse.statusCode, 200, 'Expected submit shipping call to return status code 200');
                    // Step 6: update cookies, make request to get customer credit sources
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/DigitalRiver-CustomerCredits';
                    myRequest.method = 'GET';
                    myRequest.form = null;
                    return request(myRequest);
                })
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected CustomerCredits call to return status code 200');
                    var bodyAsJson = JSON.parse(response.body);
                    assert.isTrue(bodyAsJson.success);
                    assert.isArray(bodyAsJson.customerCreditSources);
                    assert.isNumber(bodyAsJson.amountRemainingToBeContributed);
                });
        });
    });

    describe('DigitalRiver-FileLinks', function () {
        this.timeout(3000);

        it('should return array of file links', function () {
            var myRequest = {
                url: config.baseUrl + '/DigitalRiver-FileLinks?ids=00001,00002,00003',
                method: 'GET',
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
                    assert.isArray(bodyAsJson.fileLinks);
                });
        });
    });

    describe('DigitalRiver-PurchaseType', function () {
        this.timeout(10000);

        it('should return successful result of updating purchase type and billing address', function () {
            var cookieJar = request.jar();

            var myRequest = {
                url: '',
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };

            var variantPid1 = '701644033675M';
            var qty1 = 2;
            var addProd = '/Cart-AddProduct';

            // Step 1 adding product to Cart
            myRequest.url = config.baseUrl + addProd;
            myRequest.form = {
                pid: variantPid1,
                quantity: qty1
            };

            return request(myRequest)
                .then(function (addToCartResponse) {
                    assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                    // Step 2: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (tokenResponse) {
                    assert.equal(tokenResponse.statusCode, 200, 'Unable to generate CSRF token before log in');
                    var csrfJsonResponse = JSON.parse(tokenResponse.body);
                    // Step 3: Added guest customer
                    myRequest.url = config.baseUrl + '/CheckoutServices-SubmitCustomer';
                    myRequest.form = {
                        dwfrm_coCustomer_email: 'test.email@mail.com',
                        csrf_token: csrfJsonResponse.csrf.token
                    };
                    updateCookies(cookieJar, myRequest);
                    return request(myRequest);
                })
                .then(function (submitCustomerResponse) {
                    assert.equal(submitCustomerResponse.statusCode, 200, 'Expected added guest customer call to return status code 200');
                    // Step 4: get cookies, Generate CSRF, then set cookies
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    return request(myRequest);
                })
                .then(function (csrfResponse) {
                    var csrfJsonResponse = JSON.parse(csrfResponse.body);
                    // Step 5: submit shipping request to update basket with necessary custom data
                    myRequest.url = config.baseUrl + '/CheckoutShippingServices-SubmitShipping?';

                    myRequest.form = {
                        originalShipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentUUID: '7d7d6054d025074b7f9b0ac4a2',
                        shipmentSelector: 'new',
                        dwfrm_shipping_shippingAddress_addressFields_firstName: 'Tyler',
                        dwfrm_shipping_shippingAddress_addressFields_lastName: 'Durden',
                        dwfrm_shipping_shippingAddress_addressFields_address1: '2495 Midway Rd',
                        dwfrm_shipping_shippingAddress_addressFields_address2: '',
                        dwfrm_shipping_shippingAddress_addressFields_country: 'US',
                        dwfrm_shipping_shippingAddress_addressFields_states_stateCode: 'TX',
                        dwfrm_shipping_shippingAddress_addressFields_city: 'Carrollton',
                        dwfrm_shipping_shippingAddress_addressFields_postalCode: '75006-2503',
                        dwfrm_shipping_shippingAddress_addressFields_phone: '8554233729',
                        dwfrm_shipping_shippingAddress_shippingMethodID: 1,
                        dwfrm_shipping_shippingAddress_giftMessage: '',
                        csrf_token: csrfJsonResponse.csrf.token
                    };

                    return request(myRequest);
                })
                .then(function (submitShippingResponse) {
                    assert.equal(submitShippingResponse.statusCode, 200, 'Expected submit shipping call to return status code 200');
                    // Step 6: update cookies, make request to update purchase type and billing address
                    updateCookies(cookieJar, myRequest);
                    myRequest.url = config.baseUrl + '/DigitalRiver-PurchaseType';
                    myRequest.method = 'POST';
                    myRequest.form = {
                        purchaseType: 'business',
                        dwfrm_billing_addressFields_firstName: 'Tyler',
                        dwfrm_billing_addressFields_lastName: 'Durden',
                        dwfrm_billing_addressFields_address1: '2495 Midway Rd',
                        dwfrm_billing_addressFields_address2: '',
                        dwfrm_billing_addressFields_country: 'US',
                        dwfrm_billing_addressFields_stateCode: 'TX',
                        dwfrm_billing_addressFields_city: 'Carrollton',
                        dwfrm_billing_addressFields_postalCode: '75006-2503',
                        dwfrm_billing_addressFields_phone: '8554233729'
                    };
                    return request(myRequest);
                })
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected PurchaseType call to return status code 200');
                    var bodyAsJson = JSON.parse(response.body);
                    assert.isTrue(bodyAsJson.success);
                    assert.isObject(bodyAsJson.order);
                    assert.isObject(bodyAsJson.digitalRiverComplianceOptions);
                });
        });
    });

    describe('DigitalRiver-SelectCountryCurrency', function () {
        this.timeout(10000);

        it('should return json success true', function () {
            var myRequest = {
                url: config.baseUrl + '/DigitalRiver-SelectCountryCurrency?country=US&currency=USD',
                method: 'GET',
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
                    assert.isTrue(bodyAsJson.success);
                });
        });
    });
});
