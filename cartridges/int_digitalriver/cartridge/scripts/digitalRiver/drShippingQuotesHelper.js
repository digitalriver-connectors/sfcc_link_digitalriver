/* globals session*/
var ShippingQuotesService = require('*/cartridge/scripts/services/digitalRiverShippingQuotes');
var Site = require('dw/system/Site');
var BasketMgr = require('dw/order/BasketMgr');
var ProductMgr = require('dw/catalog/ProductMgr');
var URLUtils = require('dw/web/URLUtils');

var formatCurrency = require('*/cartridge/scripts/util/formatting').formatCurrency;
var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('digitalriver.shippingquotes');
var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');

/**
 * Creates the body for the Shipping Service API call
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @returns {Object} body - the body object for the Shipping Service API call
 */
function createBody() {
    var currentBasket = BasketMgr.getCurrentBasket();
    if (currentBasket) {
        var shipping = currentBasket.shipments[0].shippingAddress;
        var items = currentBasket.allProductLineItems;

        // Ship To:
        var shipTo;
        if (shipping && !empty(shipping.countryCode.value) && !empty(shipping.postalCode)) {
            shipTo = {
                address: {
                    line1: shipping.address1 || '',
                    line2: shipping.address2 || '',
                    city: shipping.city || '',
                    postalCode: shipping.postalCode,
                    state: shipping.stateCode || '',
                    country: shipping.countryCode.value
                },
                name: shipping.fullName,
                phone: shipping.phone,
                email: currentBasket.getCustomerEmail() || currentBasket.getCustomer().getProfile().getEmail() || ''
            };
        } else {
            return null;
        }

        // Ship From:
        var shipFrom = {
            address: {
                line1: Site.current.getCustomPreferenceValue('drShipFromAddress1'),
                line2: Site.current.getCustomPreferenceValue('drShipFromAddress2'),
                city: Site.current.getCustomPreferenceValue('drShipFromCity'),
                postalCode: Site.current.getCustomPreferenceValue('drShipFromPostalCode'),
                state: Site.current.getCustomPreferenceValue('drShipFromState'),
                country: Site.current.getCustomPreferenceValue('drShipFromCountry')
            }
        };

        // Packages:
        var productDetailsObj;
        var packages = [];
        var packageObj = {};
        packages.push(packageObj);
        packageObj.items = [];

        var itemArray = [];

        for (var i = 0; i < items.length; i++) {
            var product;
            var item = items[i];
            var productID = item.productID;
            if (!item.optionProductLineItem) {
                var productUrl = URLUtils.abs('Product-Show', 'pid', productID).toString();
                product = ProductMgr.getProduct(productID);
                if (product && !empty(item.quantityValue)) {
                    var isDigitalProduct = product.custom.drDigitalProduct;
                    var amount = item.getAdjustedPrice().value;
                    if (!empty(item.optionProductLineItems)) {
                        amount += item.optionProductLineItems[0].adjustedPrice.value;
                    }
                    var weight = product.custom.drWeight;
                    var weightUnit = product.custom.drWeightUnit.value;
                    var productImage = product.getImage('small').getAbsURL().toString();
                    if (product.bundle) {
                        weight = 0;
                        weightUnit = null;
                    }
                    // don't call the service if the product is a digital product
                    if (!isDigitalProduct) {
                        productDetailsObj = {
                            productDetails: {
                                id: productID,
                                skuGroupId: product.custom.drSkuGroupId || '',
                                name: product.name || '',
                                url: productUrl || '',
                                countryOfOrigin: product.custom.drCountryOfOrigin || '',
                                image: productImage || '',
                                weight: weight || '',
                                weightUnit: weightUnit,
                                partNumber: product.custom.drPartNumber || ''
                            },
                            quantity: item.quantityValue
                        };

                        if (!item.bundledProductLineItem || amount > 0) {
                            productDetailsObj.amount = parseFloat(amount.toFixed(2));
                        }
                        itemArray.push(productDetailsObj);
                    }
                }
            } else {
                logger.error('Error while getting shipping quotes');
            }
        }
        packageObj.items = itemArray;
        if (empty(itemArray)) {
            return null;
        }
        var body = {
            currency: currentBasket.currencyCode,
            shipTo: shipTo,
            shipFrom: shipFrom,
            packages: packages
        };
    }

    return body;
}

/**
 * Gets the shipping quotes from the ShippingQuotesService API
 * @param {dw.util.Collection} shippingMethods - the applicable shipping methods
 * @param {dw.order.Shipment} shipment - the target shipment object
 * @param {dw.order.ShippingMethod} drShippingMethod - the DR shipping method
 * @returns {Array} an array of shipping quotes objects
 */
function getShippingQuotes(shippingMethods, shipment, drShippingMethod) {
    var CacheMgr = require('dw/system/CacheMgr');
    var MessageDigest = require('dw/crypto/MessageDigest');
    var Bytes = require('dw/util/Bytes');
    var Encoding = require('dw/crypto/Encoding');

    var result;
    var shippingQuotes;
    var filteredMethods = [];

    var body = createBody();

    if (body) {
        var stringifiedBody = JSON.stringify(body);
        var id = session.customer.ID;
        var key = Encoding.toHex(new MessageDigest(MessageDigest.DIGEST_SHA_256).digestBytes(new Bytes(stringifiedBody, 'UTF-8'))) + id;
        var cache = CacheMgr.getCache('DRShippingQuotes');
        var checkoutPageOnly = checkoutHelper.isAllowedEndpoint();
        if (checkoutPageOnly) {
            // eslint-disable-next-line consistent-return
            result = cache.get(key, function () {
                var srResult = ShippingQuotesService.shippingQuotesAPI(body);
                if (srResult.ok) {
                    return srResult.object;
                }
            });
        }

        if (!empty(result)) {
            shippingQuotes = result.quotes;
            for (let i = 0; i < shippingQuotes.length; i++) {
                var uniqueID = Encoding.toHex(new MessageDigest(MessageDigest.DIGEST_SHA_256).digestBytes(new Bytes(JSON.stringify(shippingQuotes[i]), 'UTF-8')));
                var obj = {};
                obj.default = false;
                obj.ID = uniqueID;
                obj.drID = shippingQuotes[i].id;
                obj.displayName = shippingQuotes[i].serviceLevel;
                obj.description = shippingQuotes[i].description || null;
                obj.estimatedArrivalTime = shippingQuotes[i].estimatedDelivery || null;
                obj.shippingTerms = shippingQuotes[i].shippingTerms || null;
                obj.selected = uniqueID === shipment.custom.drUniqueID;
                obj.shippingCost = formatCurrency(shippingQuotes[i].totalAmount, body.currency);
                obj.isDR = true;
                obj.apiShippingMethod = drShippingMethod;
                obj.shipFrom = JSON.stringify(shippingQuotes[i].shipFrom);
                filteredMethods.push(obj);
            }
        } else {
            result = {
                error: true,
                errorMessage: 'Error getting shipping quotes'
            };
        }
    }

    return filteredMethods;
}

/**
 * Modifies the shipping quotes
 * @param {dw.util.Collection} quotes - the collection of shipping quotes
 * @returns {dw.util.Collection} - the modified collection of shipping quotes
 */
function modifyShippingQuotes(quotes) {
    return quotes;
}

module.exports = {
    getShippingQuotes: getShippingQuotes,
    modifyShippingQuotes: modifyShippingQuotes
};
