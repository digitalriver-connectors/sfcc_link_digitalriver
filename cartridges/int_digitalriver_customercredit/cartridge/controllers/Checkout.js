'use strict';

var server = require('server');
server.extend(module.superModule);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

server.prepend(
    'Begin',
    server.middleware.https,
    csrfProtection.generateToken,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
        var currentBasket = BasketMgr.getCurrentBasket();
        var currentStage = req.querystring.stage;

        if (!currentStage || currentStage === 'shipping') {
            drTaxHelper.resetBasketCheckoutData(currentBasket);
        }

        var drCheckoutData = JSON.parse(currentBasket.custom.drCheckoutData);
        var viewData = {
            amountRemainingToBeContributed: drCheckoutData && drCheckoutData.amountRemainingToBeContributed,
            primarySource: drCheckoutData && drCheckoutData.sources.find(function (source) {
                return source.type !== 'customerCredit';
            })
        };
        res.setViewData(viewData);
        next();
    });

module.exports = server.exports();
