'use strict';
var BasketMgr = require('dw/order/BasketMgr');
var Transaction = require('dw/system/Transaction');
var Currency = require('dw/util/Currency');
var PriceBookMgr = require('dw/catalog/PriceBookMgr');
var currentSite = require('dw/system/Site').getCurrent();
var currentBasket = BasketMgr.getCurrentBasket();

exports.onRequest = function () {
    if (currentSite.getCustomPreferenceValue('drEnableDynamicPricing') && currentSite.getCustomPreferenceValue('drUseDropInFeature')) {
        var currency = request.session.privacy.currencyCode;
        if (currency) {
            request.session.setCurrency(Currency.getCurrency(currency));
            if (currentBasket && currency && currentBasket.currencyCode !== currency) {
                Transaction.wrap(function () {
                    currentBasket.updateCurrency();
                });
            }
        }
    } else {
        var saleNamePattern = currentSite.getCustomPreferenceValue('drSaleConvertedPriceBookNaming');
        var listNamePattern = currentSite.getCustomPreferenceValue('drListConvertedPriceBookNaming');
        var saleRegex = new RegExp(saleNamePattern.replace(/\{.*?\}/g, '.*'));
        var listRegex = new RegExp(listNamePattern.replace(/\{.*?\}/g, '.*'));
        var nonDRPriceBooks = PriceBookMgr.getAllPriceBooks().toArray().filter(priceBook => !saleRegex.test(priceBook.ID) && !listRegex.test(priceBook.ID));
        PriceBookMgr.setApplicablePriceBooks(nonDRPriceBooks);
        if (currentBasket) {
            Transaction.wrap(function () {
                currentBasket.updateCurrency();
            });
        }
        request.session.privacy.currencyCode = null;
    }
};

