'use strict';

var page = module.superModule;
var server = require('server');

server.extend(page);

server.replace('SetLocale', function (req, res, next) {
    var URLUtils = require('dw/web/URLUtils');
    var Currency = require('dw/util/Currency');
    var Site = require('dw/system/Site');
    var BasketMgr = require('dw/order/BasketMgr');
    var Transaction = require('dw/system/Transaction');

    var currentBasket = BasketMgr.getCurrentBasket();

    var QueryString = server.querystring;
    var currency;
    var currentSite = Site.getCurrent();
    var allowedCurrencies = currentSite.allowedCurrencies;
    var queryStringObj = new QueryString(req.querystring.queryString || '');

    if (Object.hasOwnProperty.call(queryStringObj, 'lang')) {
        delete queryStringObj.lang;
    }

    if (req.setLocale(req.querystring.code)) {
        if (!currentSite.getCustomPreferenceValue('drEnableDynamicPricing') || !currentSite.getCustomPreferenceValue('drUseDropInFeature')) {
            currency = Currency.getCurrency(req.querystring.CurrencyCode);
            if (allowedCurrencies.indexOf(req.querystring.CurrencyCode) > -1
                && (req.querystring.CurrencyCode !== req.session.currency.currencyCode)) {
                req.session.setCurrency(currency);

                if (currentBasket && currency && currentBasket.currencyCode !== currency.currencyCode) {
                    Transaction.wrap(function () {
                        currentBasket.updateCurrency();
                    });
                }
            }
        }
        var redirectUrl = URLUtils.url(req.querystring.action).toString();
        var qsConnector = redirectUrl.indexOf('?') >= 0 ? '&' : '?';

        redirectUrl = Object.keys(queryStringObj).length === 0
            ? redirectUrl += queryStringObj.toString()
            : redirectUrl += qsConnector + queryStringObj.toString();

        res.json({
            success: true,
            redirectUrl: redirectUrl
        });
    } else {
        res.json({ error: true }); // TODO: error message
    }
    next();
});

module.exports = server.exports();
