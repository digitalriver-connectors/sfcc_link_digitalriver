'use strict';

var assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();
var Transaction = require('../../../mocks/dw/system/Transaction');
var BasketMgr = require('../../../mocks/dw/order/BasketMgr');

global.empty = function (obj) {
    if (obj === null || obj === undefined || obj === '' || (typeof (obj) !== 'function' && obj.length !== undefined && obj.length === 0)) {
        return true;
    } else {
        return false;
    }
};

var proxyquireStubs = {
    mockSuperModule : require('../../../mocks/mockModuleSuperModule'),
    mockShippingMethodModel : require('../../../mocks/mockShippingMethodModel')
};

var shipment = {
    "selectedShippingMethod": {
        "ID": "ups_worldwide_express-256.16",
        "drID": "ups_worldwide_express",
        "displayName": "UPS Worldwide Express®",
        "description": "UPS Worldwide Express®",
        "estimatedArrivalTime": null,
        "selected": false,
        "shippingCost": "$256.16",
        "isDR": true,
        "apiShippingMethod": {},
        "shipFrom": "{\"address\":{\"line1\":\"1999 Bishop Grandin Blvd.\",\"line2\":\"Unit 408\",\"city\":\"London\",\"postalCode\":\"EC1A 1BB\",\"country\":\"GB\"}}"
    },
    "applicableShippingMethods": [{
        "ID": "ups_worldwide_express-256.16",
        "drID": "ups_worldwide_express",
        "default": false,
        "displayName": "UPS Worldwide Express®",
        "description": "UPS Worldwide Express®",
        "estimatedArrivalTime": null,
        "selected": false,
        "shippingCost": "$256.16",
        "isDR": true,
        "apiShippingMethod": {},
        "shipFrom": "{\"address\":{\"line1\":\"1999 Bishop Grandin Blvd.\",\"line2\":\"Unit 408\",\"city\":\"London\",\"postalCode\":\"EC1A 1BB\",\"country\":\"GB\"}}"
    }]
};

var applicableShippingMethodsStub = [
    {
      "default": false,
      "ID": "ups_worldwide_express-256.16",
      "drID": "ups_worldwide_express",
      "displayName": "UPS Worldwide Express®",
      "description": "UPS Worldwide Express®",
      "estimatedArrivalTime": null,
      "selected": false,
      "shippingCost": "$256.16",
      "isDR": true,
      "apiShippingMethod": {},
      "shipFrom": "{\"address\":{\"line1\":\"1999 Bishop Grandin Blvd.\",\"line2\":\"Unit 408\",\"city\":\"London\",\"postalCode\":\"EC1A 1BB\",\"country\":\"GB\"}}"
    }
]

var BaseShippingModelMock = function (shipment) {
    for (var key in shipment) { // eslint-disable-line
        this[key] = shipment[key];
    }
};

const shippingMethodPath = '../../../../cartridges/int_digitalriver_sfra/cartridge/models/shipping';
const ShippingModel = proxyquire(shippingMethodPath, {
    '*/cartridge/models/shipping/shippingMethod': {
        getShippingMethod: function () {
            return proxyquireStubs.mockShippingMethodModel;
        }
    },
    '*/cartridge/scripts/checkout/shippingHelpers': {
        getApplicableShippingMethods: function () {
            return;
        }
    },
    '*/cartridge/scripts/helpers/basketCalculationHelpers': {
        calculateTotals: function () {
            return;
        }
    },
    'dw/order/BasketMgr': require('../../../mocks/dw/order/BasketMgr'),
    'dw/system/Transaction': require('../../../mocks/dw/system/Transaction')
});

describe('shipping model', function () {
    var ShippingModel;

    before(function () {
        var module = proxyquireStubs.mockSuperModule.create(BaseShippingModelMock);

        ShippingModel = proxyquire(shippingMethodPath, {
            module: {
                superModule: module
            },
            '*/cartridge/models/shipping/shippingMethod': {
                getShippingMethod: function () {
                    return proxyquireStubs.mockShippingMethodModel;
                }
            },
            '*/cartridge/scripts/checkout/shippingHelpers': {
                getApplicableShippingMethods: function () {
                    return applicableShippingMethodsStub;
                }
            },
            '*/cartridge/scripts/helpers/basketCalculationHelpers': {
                calculateTotals: function () {
                    return 100;
                }
            },
            'dw/system/Transaction': Transaction,
            'dw/order/BasketMgr': BasketMgr

        });
    });

    after(function () {
        proxyquireStubs.mockSuperModule.remove();
    });

    it('should return the info about the shipping method with given products', function () {
        var result = new ShippingModel(shipment);
        assert.equal(result.applicableShippingMethods[0].default, false);
        assert.equal(result.applicableShippingMethods[0].ID, 'ups_worldwide_express-256.16');
        assert.equal(result.applicableShippingMethods[0].drID, 'ups_worldwide_express');
        assert.equal(result.applicableShippingMethods[0].displayName, 'UPS Worldwide Express®');
        assert.equal(result.applicableShippingMethods[0].description, 'UPS Worldwide Express®');
        assert.equal(result.applicableShippingMethods[0].estimatedArrivalTime, null);
        assert.equal(result.applicableShippingMethods[0].selected, false);
        assert.equal(result.applicableShippingMethods[0].shippingCost, '$256.16');
        assert.equal(result.applicableShippingMethods[0].isDR, true);
        assert.deepEqual(result.applicableShippingMethods[0].apiShippingMethod, {});
        assert.equal(result.applicableShippingMethods[0].shipFrom, "{\"address\":{\"line1\":\"1999 Bishop Grandin Blvd.\",\"line2\":\"Unit 408\",\"city\":\"London\",\"postalCode\":\"EC1A 1BB\",\"country\":\"GB\"}}");
        assert.equal(result.selectedShippingMethod, null);
    });
});
