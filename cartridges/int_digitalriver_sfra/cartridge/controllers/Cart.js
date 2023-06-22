'use strict';

/**
 * Account base controller overridden to prepend new middleware to all the existing routes
 * Middleware checks if ecommerce functionality is enabled for site then call next function in middleware chain otherwise redirect user to homepage
 *
 */

var page = module.superModule;
var server = require('server');

server.extend(page);

server.append('Show', function (req, res, next) {
    var Site = require('dw/system/Site');

    var drShippingMethodAvailability = Site.getCurrent().getCustomPreferenceValue('drShippingMethodAvailability').value;

    var showShippingList = true;
    if (drShippingMethodAvailability) {
        if (drShippingMethodAvailability === 'both' || drShippingMethodAvailability === 'quotes') {
            showShippingList = false;
        }
    }

    res.render('cart/cart', {
        showShippingList: showShippingList
    });

    next();
});

module.exports = server.exports();
