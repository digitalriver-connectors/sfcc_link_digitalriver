'use strict';

var digitalRiver = require('*/cartridge/scripts/services/digitalRiver');
var taxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
var collections = require('*/cartridge/scripts/util/collections');
var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.checkout');

var Site = require('dw/system/Site');
var Money = require('dw/value/Money');
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var BasketMgr = require('dw/order/BasketMgr');

/**
 * Gets customers list from to Digital River
 * @param {Object} body to be sent with test request
 * @returns {dw.svc.Result} service call result
 */
function createTestCheckout(body) {
    var drCheckoutSvc = digitalRiver.createDigitalRiverService('/checkouts');
    return drCheckoutSvc.call(body);
}

/**
 * creates a checkout in Digital River's systems
 * @param {Object} currentBasket - current basket
 * @param {string} customerType - the type of DigitalRiver customer ("business" or "individual")
 * @param {boolean} includeAppliedTaxIdentifiers - whether to include previously applied TIs to the request or not
 * @returns {Object} obj - response from digital river
 */
function createCheckout(currentBasket, customerType, includeAppliedTaxIdentifiers) {
    taxHelper.resetBasketCheckoutData(currentBasket);

    // delete payment instruments from basket
    var paymentInstruments = currentBasket.getPaymentInstruments();
    Transaction.wrap(function () {
        collections.forEach(paymentInstruments, function (paymentInstrument) {
            currentBasket.removePaymentInstrument(paymentInstrument);
        });
    });

    if (empty(currentBasket.getAllProductLineItems())) {
        return new Status(Status.OK); // if basket is empty no need to recreate new checkout or calculate taxes
    }

    var ipAddress = request.httpHeaders.get('true-client-ip') || request.getHttpRemoteAddress();

    // Preparing shipping-related data
    var shipment = currentBasket.shipments[0];
    var shipping = currentBasket.shipments[0].shippingAddress;

    var shipFrom;
    if (shipment.shippingMethodID.indexOf('DRDefaultShp') > -1 && shipment.custom.drSQShipFrom) {
        shipFrom = JSON.parse(shipment.custom.drSQShipFrom);
    } else {
        shipFrom = {
            address: {
                line1: Site.current.getCustomPreferenceValue('drShipFromAddress1'),
                line2: Site.current.getCustomPreferenceValue('drShipFromAddress2'),
                city: Site.current.getCustomPreferenceValue('drShipFromCity'),
                postalCode: Site.current.getCustomPreferenceValue('drShipFromPostalCode'),
                state: Site.current.getCustomPreferenceValue('drShipFromState'),
                country: Site.current.getCustomPreferenceValue('drShipFromCountry')
            }
        };
    }

    var shipTo;
    if (shipping) {
        shipTo = {
            address: {
                line1: shipping.address1,
                line2: shipping.address2,
                city: shipping.city,
                postalCode: shipping.postalCode,
                state: shipping.stateCode,
                country: shipping.countryCode.value
            },
            name: shipping.fullName
        };
    }
    // Preparing billing-related data
    var billing = currentBasket.billingAddress;
    var billTo;
    if (billing) {
        billTo = {
            address: {
                line1: billing.address1,
                line2: billing.address2,
                city: billing.city,
                postalCode: billing.postalCode,
                state: billing.stateCode,
                country: billing.countryCode.value
            },
            name: billing.fullName,
            email: currentBasket.getCustomerEmail()
        };
    }

    // Applying shipping adjustments shipping cost amount
    var shippingPriceAdjustments = shipment.shippingPriceAdjustments.toArray();
    var shippingAmount = shippingPriceAdjustments.reduce(function (sum, adjustment) {
        return sum.add(adjustment.price);
    }, currentBasket.getShippingTotalPrice());

    var shippingChoice;

    if (shipment.shippingMethodID.indexOf('DRDefaultShp') > -1) {
        shippingChoice = {
            id: shipment.custom.drSQId,
            description: shipment.custom.drSQDescription,
            amount: shippingAmount.value,
            shippingTerms: shipment.custom.drSQShippingTerms,
            serviceLevel: shipment.custom.drSQServiceLevel
        };
    } else {
        shippingChoice = {
            amount: shippingAmount.value,
            description: shipment.shippingMethod.description,
            serviceLevel: shipment.shippingMethodID
        };
    }


    // Preparing products data
    var items = currentBasket.allProductLineItems;
    var itemArray = [];
    for (var i = 0; i < items.length; i++) {
        var metadata;
        var totalOptionsCost = new Money(0, currentBasket.currencyCode); // aggregate price for all options to add it to parent item price
        if (!items[i].optionProductLineItem) {
            metadata = {
                crossCheckoutId: items[i].getUUID() // included in metatadata to provide mapping between DR items and order line items after order is placed
            };
            if (items[i].optionProductLineItems.length !== 0) {
                var optionIterator = items[i].optionProductLineItems.iterator();
                while (optionIterator.hasNext()) {
                    var option = optionIterator.next();
                    var optionId = option.optionID;
                    var optionDescription = option.lineItemText;
                    var optionCost = option.adjustedPrice;
                    var optionValueId = option.optionValueID;
                    var optionName = option.productName;
                    var optionSkuExtension = option.parent.productID;
                    metadata[optionId] = JSON.stringify({
                        optionID: optionId,
                        optionDescription: optionDescription,
                        optionCost: optionCost.value,
                        optionValueID: optionValueId,
                        optionName: optionName,
                        optionSkuExtension: optionSkuExtension
                    });
                    totalOptionsCost = totalOptionsCost.add(optionCost);
                }
            }

            var aggregatePrice = items[i].getAdjustedPrice();
            if (totalOptionsCost.value > 0) {
                aggregatePrice = aggregatePrice.add(totalOptionsCost);
            }

            var item = {
                skuId: items[i].productID,
                quantity: items[i].quantityValue,
                aggregatePrice: aggregatePrice.value
            };
            item.metadata = metadata;

            itemArray.push(item);
        }
    }

    // false if dw.order.TaxMgr.TAX_POLICY_NET
    var TaxMgr = require('dw/order/TaxMgr');
    var taxInclusive = TaxMgr.getTaxationPolicy() === TaxMgr.TAX_POLICY_GROSS;

    var body = {
        sourceId: '',
        upstreamId: currentBasket.getUUID(),
        currency: currentBasket.currencyCode,
        taxInclusive: taxInclusive,
        browserIp: ipAddress,
        billTo: billTo,
        items: itemArray,
        locale: request.getLocale()
    };

    var isAllDigitalProductsInBasket = checkoutHelper.checkDigitalProductsOnly(currentBasket.productLineItems);

    if (!isAllDigitalProductsInBasket) {
        body.shippingChoice = shippingChoice;
        body.shipTo = shipTo;
        body.shipFrom = shipFrom;
    }

    var drCountry = checkoutHelper.getCountry(currentBasket);

    if (drCountry && drCountry.toUpperCase() !== 'US') {
        // including previously applied TIs in case we create new DR checkout after recieving 409 error in place order request
        if (includeAppliedTaxIdentifiers && !empty(currentBasket.custom.drTaxIdentifiers) && currentBasket.custom.drTaxIdentifiers !== 'undefined') {
            var appliedTaxIdentifiers = JSON.parse(currentBasket.custom.drTaxIdentifiers);
            body.taxIdentifiers = appliedTaxIdentifiers.map(function (taxIdentifier) {
                return { id: taxIdentifier.id };
            });
        } else {
            // add place for tax identifiers
            body.taxIdentifiers = [];
        }
    }

    // Calculating order level discounts to be sent to Digital River
    var orderAdjustments = currentBasket.getPriceAdjustments().toArray();
    var orderDiscount = orderAdjustments.reduce(function (sum, adjusment) {
        // Basket may contain 'digitalRiver_totalFees' price Adjustment which is not a promotion
        if (!taxHelper.isDrAdjustment(adjusment.promotionID)) {
            sum = sum.add(adjusment.price); // eslint-disable-line no-param-reassign
        }
        return sum;
    }, new Money(0, currentBasket.currencyCode));

    if (orderDiscount.value !== 0) {
        body.discount = {
            amountOff: Math.abs(orderDiscount.value)
        };
    }

    // attach customer data to payload
    var customer = currentBasket.getCustomer();
    if (customer.authenticated
        && customer.registered
    ) {
        body.customerId = customer.profile.custom.globalCommerceCustID;
        body.email = customer.profile.email;
    } else {
        body.email = currentBasket.getCustomerEmail();
    }

    if (customerType) {
        body.customerType = customerType;
    }

    var drCheckoutSvc = digitalRiver.createDigitalRiverService('/checkouts');
    logger.info('Sending "create checkout" request to {0}', drCheckoutSvc.getURL());
    var result = drCheckoutSvc.call(body);

    if (!result.ok) {
        logger.error('Error while creating checkout: {0}', JSON.stringify(result.errorMessage));
        return result;
    }
    logger.info('Checkout {0} successfully created', result.object.id);
    return result;
}

/**
 * updates the checkout specific attributes
 *
 * @param {string} checkoutId - id of the basket/order to be updated
 * @param {Object} body - body to send
 * @returns {dw.svc.Result} service call result
 */
function updateCheckout(checkoutId, body) {
    var drCheckoutSvc = digitalRiver.createDigitalRiverService('/checkouts/' + checkoutId);
    var currentBasket = BasketMgr.getCurrentBasket();
    if (currentBasket) {
        var checkoutData = JSON.parse(currentBasket.custom.drCheckoutData);
        if (!body.sourceId && !checkoutData.sources.length) {
            body.sourceId = ''; // eslint-disable-line no-param-reassign
        }
    }
    logger.info('Updating checkout {0}: {1} \n with body \n {2}', checkoutId, drCheckoutSvc.getURL(), JSON.stringify(body));
    var result = drCheckoutSvc.call(body);
    if (result.ok) {
        logger.info('Successfully updated for checkout {0}', result.object.id);
    } else if (result.error >= 500 && result.error < 600) {
        logger.info('Retrying the API call due to failure : Response Code {0} Response Message {1}', result.error, result.errorMessage);
        result = digitalRiver.drServiceRetryLogic(drCheckoutSvc, body, true);
    } else {
        logger.error('Error while updating checkout: {0}', JSON.stringify(result.errorMessage));
    }
    return result;
}

/**
 * updates the order with the email and payment information
 *
 * @param {string} checkoutId - id of the order to be updated
 * @returns {dw.svc.Result} service call result
 */
function getCheckout(checkoutId) {
    var drCheckoutSvc = digitalRiver.createDigitalRiverService('/checkouts/' + checkoutId);
    drCheckoutSvc.setRequestMethod('GET');
    logger.info('Getting checkout {0} data: {1}', checkoutId, drCheckoutSvc.getURL());
    var result = drCheckoutSvc.call();
    if (result.ok) {
        logger.info('Checkout {0} successfully retrieved', checkoutId);
    } else {
        logger.error('Error while getting checkout: {0}', JSON.stringify(result.errorMessage));
    }
    return result;
}

/**
 * creates the order in Digital River's systems
 *
 * @param {string} checkoutId - id use to create order
 * @returns {Object} Digital River response object
 */
function createOrder(checkoutId) {
    var body = {
        checkoutId: checkoutId
    };
    var drCheckoutSvc = digitalRiver.createDigitalRiverService('/orders');
    logger.info('Sending "create order" request to {0}', drCheckoutSvc.getURL());
    var result = drCheckoutSvc.call(body);
    if (result.ok) {
        logger.info('Order created', result.object.id);
    } else {
        logger.error('Error while creating order: {0}', JSON.stringify(result.errorMessage));
    }
    return result;
}

/**
 * attaches source to the checkout
 * @param {string} checkoutId - checkout id
 * @param {string} sourceId - source id
 * @returns {dw.svc.Result} service call result
 */
function attachSource(checkoutId, sourceId) {
    var drCheckoutSvc = digitalRiver.createDigitalRiverService('/checkouts/' + checkoutId + '/sources/' + sourceId);
    logger.info('Sending "attach source" request to {0}', drCheckoutSvc.getURL());
    var result = drCheckoutSvc.call();
    if (result.ok) {
        logger.info('sourceID {0} attached', result.object.id);
    } else {
        logger.error('Error while attaching source: {0}', JSON.stringify(result.errorMessage));
    }
    return result;
}

/**
 * deletes source from the checkout
 * @param {string} checkoutId - checkout id
 * @param {string} sourceId - source id
 * @returns {dw.svc.Result} service call result
 */
function deleteSource(checkoutId, sourceId) {
    var drCheckoutSvc = digitalRiver.createDigitalRiverService('/checkouts/' + checkoutId + '/sources/' + sourceId);
    drCheckoutSvc.setRequestMethod('DELETE');
    logger.info('Sending "delete source" request to {0}', drCheckoutSvc.getURL());
    var result = drCheckoutSvc.call();
    if (result.ok) {
        logger.info('sourceID {0} deleted', sourceId);
    } else {
        logger.error('Error while source deleting: {0}', JSON.stringify(result.errorMessage));
    }
    return result;
}

/**
 * Refresh the order in Digital River's systems
 *
 * @param {string} drOrderId - id use to refresh order
 * @returns {Object} Digital River response object
 */
function refreshOrder(drOrderId) {
    var drRefreshSvc = digitalRiver.createDigitalRiverService('/orders/' + drOrderId + '/refresh');
    drRefreshSvc.setRequestMethod('POST');
    var result = drRefreshSvc.call();
    if (result.ok) {
        logger.info('orderId {0} refreshed', drOrderId);
    } else {
        logger.error('Error while source refresh: {0}', JSON.stringify(result.errorMessage));
    }
    return result;
}

/**
 * updating the order in Digital River's systems with upstreamId
 *
 * @param {string} drOrderId - id use to update order
 * @param {string} sfOrderId - salesforce order id
 * @returns {Object} Digital River response object
 */
function updateDROrderWithUpstreamId(drOrderId, sfOrderId) {
    var body = {
        upstreamId: sfOrderId
    };
    var drRefreshSvc = digitalRiver.createDigitalRiverService('/orders/' + drOrderId);
    drRefreshSvc.setRequestMethod('POST');
    var result = drRefreshSvc.call(body);
    if (result.ok) {
        logger.info('updated upstreamId {0} ', sfOrderId);
    } else {
        logger.error('Error while updating upstreamId to the order: {0}', JSON.stringify(result.errorMessage));
    }
    return result;
}
module.exports = {
    createCheckout: createCheckout,
    updateCheckout: updateCheckout,
    createOrder: createOrder,
    createTestCheckout: createTestCheckout,
    getCheckout: getCheckout,
    attachSource: attachSource,
    deleteSource: deleteSource,
    refreshOrder: refreshOrder,
    updateDROrderWithUpstreamId: updateDROrderWithUpstreamId
};
