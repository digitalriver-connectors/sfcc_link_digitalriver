'use strict';

var assert = require('chai').assert;
var mockSuperModule = require('../../../mocks/mockModuleSuperModule');

var BaseOrderModelMock = function (lineItemContainer) {
    var parentOutputMock = lineItemContainer.parentOutputMock || {};
    for (var key in parentOutputMock) { // eslint-disable-line
        this[key] = JSON.parse(JSON.stringify(parentOutputMock[key]));
    }
};

describe('order model', function () {
    var OrderModel;

    before(function () {
        mockSuperModule.create(BaseOrderModelMock);
        OrderModel = require('../../../../cartridges/int_digitalriver_sfra/cartridge/models/order');
    });

    after(function () {
        mockSuperModule.remove();
    });

    it('should add drOrderID property to the order model', function () {
        var lineItemContainer = {
            custom: {
                drOrderID: '123456789'
            }
        };
        var result = new OrderModel(lineItemContainer);
        assert.equal(result.drOrderID, '123456789');
    });
});
