'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var mockSuperModule = require('../../../mocks/mockModuleSuperModule');
var Site = require('../../../mocks/dw/system/Site');
var Money = require('../../../mocks/dw/value/Money');

var drTaxHelper = proxyquire('../../../../cartridges/int_digitalriver/cartridge/scripts/digitalRiver/drTaxHelper', {
    'dw/value/Money': Money,
    'dw/web/Resource': require('../../../mocks/dw/web/Resource'),
    'dw/order/TaxMgr': require('../../../mocks/dw/order/TaxMgr'),
    'dw/system/Transaction': require('../../../mocks/dw/system/Transaction')
});

var BaseTotalsModelMock = function (lineItemContainer) {
    var parentOutputMock = lineItemContainer.parentOutputMock || {};
    for (var key in parentOutputMock) { // eslint-disable-line
        this[key] = JSON.parse(JSON.stringify(parentOutputMock[key]));
    }
};

var createTestBasket = function (priceAdjustmentsArray, shipmentLineItemsArray) {
    var basePrice = new Money(100, 'USD');
    var priceWithAdjustments = priceAdjustmentsArray.reduce(
        function (currentPrice, adjustment) {
            return currentPrice.add(adjustment.getPrice());
        },
        basePrice);

    var shipment = {
        shipmentLineItems: shipmentLineItemsArray,
        getShippingLineItem: function (id) {
            return this.shipmentLineItems.find(function (item) { return item.ID === id; });
        }
    };

    return {
        basePrice: basePrice,
        priceWithAdjustments: priceWithAdjustments,
        totalGrossPrice: priceWithAdjustments,
        couponLineItems: [],
        shipments: [shipment],
        shippingTotalPrice: new Money(20, 'USD'),
        priceAdjustments: priceAdjustmentsArray,
        allShippingPriceAdjustments: [],
        getAdjustedMerchandizeTotalPrice: function (considerAdjustments) {
            return considerAdjustments ? priceWithAdjustments : basePrice;
        },
        getPriceAdjustmentByPromotionID: function (id) {
            return priceAdjustmentsArray.find(function (item) { return item.promotionID === id; });
        },
        getCurrencyCode: function () {
            return 'USD';
        }
    };
};

function getPriceAdjustments(adjustmentToAdd) {
    var priceAdjustments = [{
        UUID: 10987654321,
        calloutMsg: 'some call out message',
        basedOnCoupon: false,
        price: new Money(-10, 'USD'),
        lineItemText: 'someString',
        promotion: { calloutMsg: 'some call out message' },
        getPrice: function () {
            return this.price;
        }
    }];

    if (adjustmentToAdd) {
        priceAdjustments.push(adjustmentToAdd);
    }

    return priceAdjustments;
}

var totalFeesPriceAdjustment = {
    UUID: 10987654324,
    calloutMsg: 'price adjustment without promotion msg',
    basedOnCoupon: false,
    price: new Money(5, 'USD'),
    lineItemText: 'Total fees value',
    promotionID: 'digitalRiver_totalFees',
    getPrice: function () {
        return this.price;
    }
};

var dutyShippingLineItem = {
    UUID: 10987654323,
    ID: 'digitalRiver_duty',
    price: new Money(5, 'USD'),
    getPrice: function () {
        return this.price;
    }
};

var importerShippingLineItem = {
    UUID: 10987654323,
    ID: 'digitalRiver_importerTax',
    price: new Money(5, 'USD'),
    getPrice: function () {
        return this.price;
    }
};

describe('totals model', function () {
    var TotalsModel;

    before(function () {
        mockSuperModule.create(BaseTotalsModelMock);
        TotalsModel = proxyquire('../../../../cartridges/int_digitalriver_sfra/cartridge/models/totals',
            {
                'dw/util/StringUtils': require('../../../mocks/dw/util/StringUtils'),
                '*/cartridge/scripts/util/collections': require('../../../mocks/sfra/scripts/util/collections'),
                'dw/util/HashMap': require('../../../mocks/dw/util/HashMap'),
                'dw/util/Template': require('../../../mocks/dw/util/Template'),
                'dw/system/Site': Site,
                'dw/value/Money': Money,
                '*/cartridge/scripts/digitalRiver/drTaxHelper': {
                    isImporterOfRecordTax: function () {
                        return true;
                    },
                    getTaxDiscount: function () {
                        return -10;
                    },
                    isDrAdjustment: drTaxHelper.isDrAdjustment,
                    FEES_ADJUSTMENT: drTaxHelper.FEES_ADJUSTMENT
                }
            }
        );
    });

    after(function () {
        mockSuperModule.remove();
    });

    describe('duty', function () {
        it('should exclude \'duty\' shipping line item adjustment during shipping calculation', function () {
            Site.setTestCustomPreferences({ drUseDropInFeature: true });
            var lineItemContainer = createTestBasket([], [dutyShippingLineItem]);
            var result = new TotalsModel(lineItemContainer);
            assert.equal(result.totalShippingCost, '$15');
        });

        it('should add \'duty\' property to totals with duty price adjustment amount', function () {
            Site.setTestCustomPreferences({ drUseDropInFeature: true });
            var lineItemContainer = createTestBasket([], [dutyShippingLineItem]);
            var result = new TotalsModel(lineItemContainer);
            assert.equal(result.duty.value, 5);
            assert.equal(result.duty.formatted, '$5');
        });
    });

    describe('importerTax', function () {
        it('should exclude \'importerTax\' shipping line item adjustment during shipping calculation', function () {
            Site.setTestCustomPreferences({ drUseDropInFeature: true });
            var lineItemContainer = createTestBasket([], [importerShippingLineItem]);
            var result = new TotalsModel(lineItemContainer);
            assert.equal(result.totalShippingCost, '$15');
        });

        it('should add \'importerTax\' property to totals with importerTax price adjustment amount', function () {
            Site.setTestCustomPreferences({ drUseDropInFeature: true });
            var lineItemContainer = createTestBasket([], [importerShippingLineItem]);
            var result = new TotalsModel(lineItemContainer);
            assert.equal(result.importerTax.value, 5);
            assert.equal(result.importerTax.formatted, '$5');
        });
    });

    describe('totalFees', function () {
        it('should exclude \'totalFees\' price adjustment during orderLevelDiscountTotal calculation', function () {
            var basketPriceAdjustmentsWithTotalFees = getPriceAdjustments(totalFeesPriceAdjustment);
            Site.setTestCustomPreferences({ drUseDropInFeature: true });
            var lineItemContainer = createTestBasket(basketPriceAdjustmentsWithTotalFees, []);
            var result = new TotalsModel(lineItemContainer);
            assert.equal(result.orderLevelDiscountTotal.value, 10);
            assert.equal(result.orderLevelDiscountTotal.formatted, '$10');
        });

        it('should add \'totalFees\' property to totals with totalFees price adjustment amount', function () {
            var basketPriceAdjustmentsWithTotalFees = getPriceAdjustments(totalFeesPriceAdjustment);

            Site.setTestCustomPreferences({ drUseDropInFeature: true });
            var lineItemContainer = createTestBasket(basketPriceAdjustmentsWithTotalFees, []);
            var result = new TotalsModel(lineItemContainer);
            assert.equal(result.totalFees.value, 5);
            assert.equal(result.totalFees.formatted, '$5');
        });

        it('should exclude \'totalFees\' price adjustment from the list of discounts', function () {
            var basketPriceAdjustmentsWithTotalFees = getPriceAdjustments(totalFeesPriceAdjustment);

            Site.setTestCustomPreferences({ drUseDropInFeature: true });
            var lineItemContainer = createTestBasket(basketPriceAdjustmentsWithTotalFees, []);
            var result = new TotalsModel(lineItemContainer);
            assert.lengthOf(result.discounts, 1);
            var promoIds = result.discounts.map(function (discount) { return discount.promotionID; });
            assert.notInclude(promoIds, 'digitalRiver_totalFees');
        });
    });

    describe('drTaxDiscountTotal', function () {
        it('should add \'drTaxDiscountTotal\' property to totals with total tax discount amount', function () {
            var lineItemContainer = createTestBasket([], []);
            var result = new TotalsModel(lineItemContainer);
            assert.equal(result.drTaxDiscountTotal.value, -10);
            assert.equal(result.drTaxDiscountTotal.formatted, '$-10');
        });
    });

    describe('grandTotal', function () {
        it('should add \'grandTotal\' property to totals with grand total amount', function () {
            var lineItemContainer = createTestBasket([], []);
            var result = new TotalsModel(lineItemContainer);
            assert.equal(result.grandTotal, '$90');
        });
    });

    describe('isZeroTotal', function () {
        it('should add \'isZeroTotal\' property to totals that depends on the grand total value', function () {
            var lineItemContainer = createTestBasket([], []);
            var result = new TotalsModel(lineItemContainer);
            assert.isFalse(result.isZeroTotal);
        });
    });

    it('should not override parent model properties if dropin feature is disabled', function () {
        var basketPriceAdjustmentsWithFees = getPriceAdjustments(totalFeesPriceAdjustment);

        Site.setTestCustomPreferences({ drUseDropInFeature: false });
        var lineItemContainer = createTestBasket(basketPriceAdjustmentsWithFees);
        var result = new TotalsModel(lineItemContainer);
        assert.isEmpty(result);
    });
});
