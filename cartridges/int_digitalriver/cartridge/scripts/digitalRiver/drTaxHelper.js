'use strict';

var Money = require('dw/value/Money');
var Resource = require('dw/web/Resource');
var TaxMgr = require('dw/order/TaxMgr');
var Transaction = require('dw/system/Transaction');

const TAX_ADJUSTMENT = 'digitalRiver_TaxAdjustment';
const ITEM_ADJUSTMENT = 'digitalRiver_ItemAdjustment';
const FEES_ADJUSTMENT = 'digitalRiver_totalFees';
const IS_TAX_INCLUSIVE = (TaxMgr.getTaxationPolicy() === TaxMgr.TAX_POLICY_GROSS);

/**
 * check if promotion is Digital River adjustment
 * @param {string} promotionID - promotion ID
 * @returns {boolean} - true if Digital River promotion
 */
function isDrAdjustment(promotionID) {
    const DR_ORDER_ADJUSTMENTS = [TAX_ADJUSTMENT, FEES_ADJUSTMENT];
    return DR_ORDER_ADJUSTMENTS.indexOf(promotionID) !== -1;
}

/**
 * Converts basket line items into a string snapshot
 * @param {dw.order.Basket} basket current basket
 * @returns {string} representing all basket line items and their price
 */
function createBasketStateSnapshot(basket) {
    return basket.getAllLineItems()
        .toArray()
        .filter(function (item) {
            return !(item instanceof dw.order.PriceAdjustment && (item.promotionID === TAX_ADJUSTMENT || item.promotionID === FEES_ADJUSTMENT || item.promotionID === ITEM_ADJUSTMENT));
        })
        .map(function (item) {
            return item.constructor.name
                + '(' + item.getUUID() + '):'
                + ((item instanceof dw.order.ProductLineItem || item instanceof dw.order.ShippingLineItem) ? item.getPriceValue() : '')
                + ((item instanceof dw.order.ProductLineItem) ? '(' + item.quantity.value + ')' : '');
        })
        .sort()
        .join('|');
}

/**
 * Checks wether existing checkout data is valid for current basket
 * @param {Object} checkoutData saved from previous Digital River Checkout API response
 * @param {dw.order.Basket} currentBasket current basket
 * @returns {boolean} if checkout data is not valid for current basket
 */
function checkoutDataIsValid(checkoutData, currentBasket) {
    return checkoutData ? checkoutData.basketState === createBasketStateSnapshot(currentBasket) : false;
}

/**
 * Applies shipping cost provided by Digital River as a Shipment Line item of current Shipment
 * with positive amount and 'digitalRiver_{type}' id
 * e.g.: duty = digitalRiver_duty, or importerTax = digitalRiver_importerTax
 * @param {number} shippingCost amount provided by Digital River
 * @param {dw.order.Basket} basket current basket
 * @param {string} type type of shipping cost to apply
 */
function applyShippingCostToBasket(shippingCost, basket, type) {
    var shippingLineItemId = 'digitalRiver_' + type;
    var currentShipment = basket.shipments[0];
    var adjustmentShipmentLI = currentShipment.getShippingLineItem(shippingLineItemId);
    if (empty(adjustmentShipmentLI)) {
        adjustmentShipmentLI = currentShipment.createShippingLineItem(shippingLineItemId);
        adjustmentShipmentLI.setLineItemText(Resource.msg('label.order.sales.' + type, 'digitalriver', null));
    }
    adjustmentShipmentLI.setPriceValue(shippingCost);
}

/**
 * Applies fee provided by Digital River as a basket price Adjustment
 * with positive amount and 'digitalRiver_{adjustmentType}' id
 * e.g.: totalFees = digitalRiver_totalFees
 * @param {number} adjustmentAmount amount provided by Digital River
 * @param {number} adjustmentTaxAmount tax amount provided by Digital River
 * @param {dw.order.Basket} basket current basket
 * @param {string} adjustmentType type of adjustment to apply
 */
function applyFeeToBasket(adjustmentAmount, adjustmentTaxAmount, basket, adjustmentType) {
    var adjustmentId = 'digitalRiver_' + adjustmentType;
    var oldAdjustment = basket.getPriceAdjustmentByPromotionID(adjustmentId);
    var adjustmentPrice = IS_TAX_INCLUSIVE ? adjustmentAmount + adjustmentTaxAmount : adjustmentAmount;
    // if there is outdated adjustment or no adjustment at all in current basket, new should be created
    if (!oldAdjustment || oldAdjustment.getPrice().value !== adjustmentPrice) {
        if (oldAdjustment) {
            basket.removePriceAdjustment(oldAdjustment); // remove old fee adjustment if it exists
        }
        var newAdjustment = basket.createPriceAdjustment(adjustmentId);
        newAdjustment.setLineItemText(Resource.msg('label.order.sales.' + adjustmentType, 'digitalriver', null));
        newAdjustment.setPriceValue(adjustmentPrice);
        newAdjustment.updateTaxAmount(new Money(adjustmentTaxAmount, basket.getCurrencyCode()));
    }
}

/**
 * Parses checkout from string to object
 * @param {string} checkoutData data saved from Digital River Checkout API call
 * @returns {Object} parsed data or null
 */
function parseCheckoutData(checkoutData) {
    if (!checkoutData) {
        return null;
    }
    return JSON.parse(checkoutData);
}

/**
 * Saves to product lines custom attributes ids of relevant items on Digital River side
 * @param {dw.order.Basket} basket current basket
 * @param {array} drItems array of Digial River items object
 * @param {boolean} importerOfRecordTax flag for handling tax and fees
 */
function mapLineItemsWithDigitalRiver(basket, drItems, importerOfRecordTax) {
    var lineItems = basket.getAllProductLineItems() // collects all pli's into a id-object map
        .toArray()
        .reduce(function (result, item) {
            result[item.getUUID()] = item; // eslint-disable-line no-param-reassign
            return result;
        }, {});
    drItems.forEach(function (drItem) {
        var sfccItem = lineItems[drItem.metadata.crossCheckoutId];
        sfccItem.custom.digitalRiverID = drItem.metadata.crossCheckoutId; // this is a temporary value for consistent item identification
        // temporary ID is needed as far as line items ids changes both on SFCC and Digital River sides after order is placed
        // this value will be replaced with final Digital River item id after order is placed

        if (importerOfRecordTax) {
            // importerTax
            sfccItem.custom.drIORTaxAmount = drItem.importerTax.amount || 0;
            // duty
            sfccItem.custom.drDutyAmount = drItem.duties.amount || 0;
            // fees
            sfccItem.custom.drFeeAmount = drItem.fees.amount;
            sfccItem.custom.drFeeTaxAmount = drItem.fees.taxAmount;
            sfccItem.custom.drFeeDetails = JSON.stringify(drItem.fees.drFeeDetails);
        }
    });
}

/**
 * Saves tax data provided by Digital River to be calculated later with basket calculateTax hook
 * @param {Object} drResponse Digital River Checkout API response
 * @param {dw.order.Basket} basket current basket
 * @param {boolean} updateBasketState update Basket state property in the Digital River checkout
 * @returns {Object} stringified checkout data
 */
function updateBasketCheckoutData(drResponse, basket, updateBasketState) {
    var currentBasket = basket;
    var items = drResponse.items.map(function (item) {
        return {
            skuId: item.skuId,
            digitalRiverID: item.metadata.crossCheckoutId,
            amount: item.amount,
            tax: {
                rate: item.tax.rate,
                amount: item.tax.amount
            }
        };
    });

    var isShippingChoice = Object.hasOwnProperty.call(drResponse, 'shippingChoice');

    var oldCheckoutData = parseCheckoutData(currentBasket.custom.drCheckoutData);
    var oldBasketState = (oldCheckoutData && oldCheckoutData.basketState) ? oldCheckoutData.basketState : null;

    var checkoutData = {
        sources: drResponse.payment.sources || [],
        amountRemainingToBeContributed: drResponse.payment.session.amountRemainingToBeContributed,
        amount: drResponse.totalAmount,
        shippingAmount: isShippingChoice ? drResponse.shippingChoice.amount : 0,
        shippingTax: isShippingChoice ? drResponse.shippingChoice.taxAmount : 0,
        items: items,
        importerOfRecordTax: drResponse.importerOfRecordTax,
        totalDuty: drResponse.totalDuty,
        totalImporterTax: drResponse.totalImporterTax,
        totalTax: drResponse.totalTax,
        sellingEntity: drResponse.sellingEntity,
        customerType: drResponse.customerType
    };

    Transaction.wrap(function () {
        // importerOfRecordTax = false, do not show Duty or IOR Tax fields
        if (checkoutData.importerOfRecordTax) {
            if (checkoutData.totalDuty) {
                applyShippingCostToBasket(checkoutData.totalDuty, currentBasket, 'duty');
                currentBasket.custom.drDuty = checkoutData.totalDuty;
            }
            if (checkoutData.totalImporterTax) {
                applyShippingCostToBasket(checkoutData.totalImporterTax, currentBasket, 'importerTax');
                currentBasket.custom.drTotalImporterTax = checkoutData.totalImporterTax;
            }
        }

        if (Object.hasOwnProperty.call(drResponse, 'totalFees')) {
            var totalFeesTax = drResponse.items.reduce(function (acc, item) {
                return item.fees ? acc + item.fees.taxAmount : acc;
            }, 0);
            applyFeeToBasket(drResponse.totalFees, totalFeesTax, currentBasket, 'totalFees');
            currentBasket.custom.drTotalFees = drResponse.totalFees;
        }

        mapLineItemsWithDigitalRiver(basket, drResponse.items, checkoutData.importerOfRecordTax);

        checkoutData.basketState = updateBasketState ? createBasketStateSnapshot(basket) : oldBasketState; // save basket state to checkout data to check whether basket has changed and DR checkout requires update

        currentBasket.custom.drCheckoutID = drResponse.id; // eslint-disable-line no-param-reassign
        currentBasket.custom.drPaymentSessionId = drResponse.payment.session.id; // eslint-disable-line no-param-reassign
        currentBasket.custom.drCheckoutData = JSON.stringify(checkoutData);
        currentBasket.custom.drTaxIdentifiers = JSON.stringify(drResponse.taxIdentifiers);
        currentBasket.custom.drTaxIdentifierType = drResponse.customerType;
    });
    return checkoutData;
}

/**
 * Get total shipping amount according site taxation policy from
 * Digital River checkout response
 * @param {Object} drResponse - Digital River checkout response object
 * @returns {number} - total shipping amount according site taxation policy
 */
function getShippingAmount(drResponse) {
    var result = 0;
    if (drResponse.shippingChoice) {
        result = drResponse.shippingChoice.amount
            + (IS_TAX_INCLUSIVE && drResponse.shippingChoice.taxAmount ? drResponse.shippingChoice.taxAmount : 0);
    }
    return Math.round(result * 100) / 100;
}

/**
 * Get shipping amount and shipping description from Basket
 * @param {dw.order.Basket} basket current basket
 * @returns {Object} - shipping amount and shipping description
 */
function getShippingChoice(basket) {
    var shipment = basket.shipments[0];
    var shippingPriceAdjustments = shipment.shippingPriceAdjustments.toArray();
    var allShippingAmount = shippingPriceAdjustments.reduce(function (sum, adjustment) {
        return sum.add(adjustment.price);
    }, basket.getShippingTotalPrice());

    // Remove Digital River ShippingLineItems from shipping amount
    var shipmentLI = shipment.getShippingLineItems().toArray();
    var shippingAmount = shipmentLI.reduce(function (sum, lineItem) {
        return lineItem.getID().indexOf('digitalRiver_') === -1 ? sum : sum.subtract(lineItem.getPrice());
    }, allShippingAmount);

    return {
        amount: shippingAmount.value,
        description: shipment.shippingMethod.description,
        serviceLevel: shipment.shippingMethodID
    };
}

/**
 * Saves tax data provided by Digital River to be calculated later with basket calculateTax hook
 * @param {Object} drResponse Digital River Checkout API response
 * @param {dw.order.Basket} basket current basket
 * @param {boolean} updateBasketState update Basket state property in the Digital River checkout
 * @returns {Object} stringified checkout data
 */
function saveCheckoutDataToBasket(drResponse, basket, updateBasketState) {
    var currentBasket = basket || require('dw/order/BasketMgr').getCurrentBasket();
    var checkoutData = updateBasketCheckoutData(drResponse, currentBasket, updateBasketState);

    // Added to bypass SFCC issue. In the Basket,
    // the shipping cost is not updated after the AdjustedTotalPrice is changed.
    require('*/cartridge/scripts/checkout/checkoutHelpers').recalculateBasket(currentBasket);

    var shippingChoice = getShippingChoice(basket);

    if (shippingChoice.amount !== getShippingAmount(drResponse)) {
        var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');
        var drResponseNew = drCheckoutAPI.updateCheckout(drResponse.id, { shippingChoice: shippingChoice });
        if (drResponseNew.ok) {
            checkoutData = updateBasketCheckoutData(drResponseNew.object, currentBasket, updateBasketState);
        }
    }
    return checkoutData;
}

/**
 * Resets all basket custom values related to specific Digital River Checkout
 * @param {Object} checkoutUpdates object with properties that need to be updated in current basket checkout data
 * @param {dw.order.Basket} basket current basket
 */
function updateCheckoutDataInBasket(checkoutUpdates, basket) {
    var currentBasket = basket || require('dw/order/BasketMgr').getCurrentBasket();
    var checkoutData = JSON.parse(currentBasket.custom.drCheckoutData);

    Object.keys(checkoutUpdates).forEach(function (prop) {
        checkoutData[prop] = checkoutUpdates[prop];
    });

    Transaction.wrap(function () {
        currentBasket.custom.drCheckoutData = JSON.stringify(checkoutData);
    });
}

/**
 * Resets all basket custom values related to specific Digital River Checkout
 * @param {dw.order.Basket} basket current basket
 */
function resetBasketCheckoutData(basket) {
    Transaction.wrap(function () {
        var currentShipment = basket.shipments[0];
        var shipmentLI = currentShipment.getShippingLineItems().toArray();
        var drShipments = shipmentLI.filter(function (item) {
            return item.getID().indexOf('digitalRiver_') > -1;
        });
        drShipments.forEach(function (item) {
            currentShipment.removeShippingLineItem(item);
        });

        var feesAdjustment = basket.getPriceAdjustmentByPromotionID('digitalRiver_totalFees');
        if (feesAdjustment) {
            basket.removePriceAdjustment(feesAdjustment);
        }

        // remove all tax adjustments
        var allLineItems = basket.getAllLineItems();
        for (var i = 0; i < allLineItems.length; i++) {
            var item = allLineItems[i];
            if (item instanceof dw.order.ProductLineItem) {
                var adjustment = item.getPriceAdjustmentByPromotionID(TAX_ADJUSTMENT);
                if (adjustment) {
                    item.removePriceAdjustment(adjustment); // remove old tax adjustment if it exists
                }
            } else if (item instanceof dw.order.ShippingLineItem) {
                var shippingPriceAdjustments = item.getShippingPriceAdjustments();
                for (var k = 0; k < shippingPriceAdjustments.length; k++) {
                    if (shippingPriceAdjustments[k].promotionID === TAX_ADJUSTMENT) {
                        item.removeShippingPriceAdjustment(shippingPriceAdjustments[k]);
                    }
                }
            }
        }

        basket.custom.drCheckoutID = null; // eslint-disable-line no-param-reassign
        basket.custom.drPaymentSessionId = null; // eslint-disable-line no-param-reassign
        basket.custom.drCheckoutData = null; // eslint-disable-line no-param-reassign
    });
}

/**
 * Get checkout data
 * @param {dw.order.Basket|Object} basket current basket or order model
 * @returns {Object} -
 */
function getCheckoutData(basket) {
    var currentBasket;
    var drData;
    currentBasket = basket || require('dw/order/BasketMgr').getCurrentBasket();
    if (currentBasket) {
        drData = currentBasket.custom ? JSON.parse(currentBasket.custom.drCheckoutData) : false;
    }
    return drData;
}

/**
 * Checks custom basket attributes
 * @param {dw.order.Basket} basket current basket
 * @returns {boolean} -
 */
function isImporterOfRecordTax(basket) {
    var drData = getCheckoutData(basket);
    var importerOfRecordTax = (!empty(drData) && drData.importerOfRecordTax === true); // otherwise can return null
    return importerOfRecordTax;
}

/**
 * Get compliance entity
 * @param {dw.order.Basket} basket current basket
 * @returns {boolean} -
 */
function getComplianceEntity(basket) {
    var currentSite = require('dw/system/Site').getCurrent();
    var defaultComplianceEntity = currentSite.getCustomPreferenceValue('drDefaultEntity') ? currentSite.getCustomPreferenceValue('drDefaultEntity') : false;
    var drData = getCheckoutData(basket);
    var complianceEntity = drData && drData.sellingEntity ? drData.sellingEntity.id : defaultComplianceEntity;
    return complianceEntity;
}

/**
 * Checks if tax exemption from Digital River is enabled
 * @param {dw.customer.Customer} customer - current customer
 * @param {dw.order.Basket} basket - current basket
 * @returns {Object} - tax exemption data
 */
function getTaxExemptData(customer, basket) {
    var currentSite = require('dw/system/Site').getCurrent();
    var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
    var drCountry = checkoutHelper.getCountry(basket);

    return {
        drUseUSTaxExemptions: currentSite.getCustomPreferenceValue('drUseUSTaxExemptions'),
        loggedInCustomer: customer.authenticated && customer.registered,
        hasGlobalCommerceCustID: !empty(customer.profile && customer.profile.custom.globalCommerceCustID),
        validCountry: drCountry && drCountry.toUpperCase() === 'US'
    };
}

/**
 * Update price adjustments include tax adjustments for current basket
 * @param {dw.order.Basket} basket current basket
 * @returns {Array} - array of applied promotions to products
 */
function updateTaxPromotion(basket) {
    var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
    var formatMoney = require('dw/util/StringUtils').formatMoney;
    var promotionNotes = [];

    if (!IS_TAX_INCLUSIVE) return promotionNotes;

    var checkoutData = parseCheckoutData(basket.custom.drCheckoutData);
    if (!checkoutData || !checkoutDataIsValid(checkoutData, basket)) return promotionNotes;

    // check and update ProductLineItems tax price adjustment
    var productLineItems = basket.getProductLineItems();
    var checkoutLineItems = checkoutData.items;
    var aggregateBasketPriceItem;
    var adjustedValue;
    var itemTotalAdjustmentValue;

    for (var i = 0; i < productLineItems.length; i++) {
        itemTotalAdjustmentValue = 0;
        var productItem = productLineItems[i];
        var checkoutItem = checkoutLineItems.find(function (item) { // eslint-disable-line no-loop-func
            return productItem.custom.digitalRiverID === item.digitalRiverID;
        });

        aggregateBasketPriceItem = checkoutHelper.getAggregatePriceItem(productItem, basket.currencyCode);
        adjustedValue = (checkoutItem.amount + checkoutItem.tax.amount) - aggregateBasketPriceItem.value;

        if (Math.abs(adjustedValue) >= 0.01) {
            // remove existing tax adjustment
            var productPromotionNotes = productItem.getPriceAdjustments()
                .toArray()
                .map(function (adjustment) { // eslint-disable-line no-loop-func
                    var result = {
                        promotionID: adjustment.promotionID,
                        amount: formatMoney(adjustment.price)
                    };
                    itemTotalAdjustmentValue += adjustment.price.value;
                    productItem.removePriceAdjustment(adjustment);
                    return result;
                });
            if (productPromotionNotes && productPromotionNotes.length > 0) {
                promotionNotes.push({
                    productID: productItem.productID,
                    promotion: productPromotionNotes
                });
            }

            // set  product line item tax adjustment
            var newAdjustment = productItem.createPriceAdjustment(TAX_ADJUSTMENT);
            newAdjustment.setLineItemText(Resource.msg('label.order.discount.tax', 'digitalriver', null));
            newAdjustment.setPriceValue(adjustedValue);
            newAdjustment.updateTaxAmount(new Money(0, basket.currencyCode));

            // set total product line item adjustment
            if (Math.abs(itemTotalAdjustmentValue) >= 0.01) {
                newAdjustment = productItem.createPriceAdjustment(ITEM_ADJUSTMENT);
                newAdjustment.setLineItemText(Resource.msg('label.order.discount.promo', 'digitalriver', null));
                newAdjustment.setPriceValue(itemTotalAdjustmentValue);
                newAdjustment.updateTaxAmount(new Money(0, basket.currencyCode));
            }
        }
    }

    // check and update ShippingLineItem adjustments shipping cost amount
    var shipment = basket.shipments[0];
    aggregateBasketPriceItem = shipment.getShippingLineItems()
        .toArray()
        .reduce(function (sum, shippingItem) {
            return shippingItem.getID().indexOf('digitalRiver_') > -1 ? sum.subtract(shippingItem.adjustedPrice) : sum;
        }, shipment.getAdjustedShippingTotalPrice());
    adjustedValue = (checkoutData.shippingAmount + checkoutData.shippingTax) - aggregateBasketPriceItem.value;
    itemTotalAdjustmentValue = 0;

    // add new shippment tax adjustment
    if (Math.abs(adjustedValue) >= 0.01) {
        // remove all shipping adjustments
        var shippingPromotionNotes = shipment.getShippingPriceAdjustments()
            .toArray()
            .map(function (adjustment) {
                var result = {
                    promotionID: adjustment.promotionID,
                    amount: formatMoney(adjustment.price)
                };
                itemTotalAdjustmentValue += adjustment.price.value;
                shipment.removeShippingPriceAdjustment(adjustment);
                return result;
            });
        if (shippingPromotionNotes && shippingPromotionNotes.length > 0) {
            promotionNotes.push({
                shippingID: shipment.ID,
                promotion: shippingPromotionNotes
            });
        }

        // set new DigitalRiver shipping line item tax adjustment
        var shippingTaxAdjustment = shipment.createShippingPriceAdjustment(TAX_ADJUSTMENT);
        shippingTaxAdjustment.setLineItemText(Resource.msg('label.order.shipping.discount.tax', 'digitalriver', null));
        shippingTaxAdjustment.setPriceValue(adjustedValue);
        shippingTaxAdjustment.updateTaxAmount(new Money(0, basket.currencyCode));

        // set total shipping line item adjustment
        if (Math.abs(itemTotalAdjustmentValue) >= 0.01) {
            var shippingPromotionAdjustment = shipment.createShippingPriceAdjustment(ITEM_ADJUSTMENT);
            shippingPromotionAdjustment.setLineItemText(Resource.msg('label.order.shipping.promotion', 'digitalriver', null));
            shippingPromotionAdjustment.setPriceValue(itemTotalAdjustmentValue);
            shippingPromotionAdjustment.updateTaxAmount(new Money(0, basket.currencyCode));
        }
    }
    basket.updateTotals();
    return promotionNotes;
}

/**
 * Get Digital River total tax discount
 * @param {dw.order.Basket} basket - current basket
 * @returns {number} - total tax discount
 */
function getTaxDiscount(basket) {
    var checkoutHelper = require('*/cartridge/scripts/digitalRiver/drCheckoutHelper');
    if (!basket || !IS_TAX_INCLUSIVE) return null;

    var checkoutData = parseCheckoutData(basket.custom.drCheckoutData);
    if (!checkoutData || !checkoutDataIsValid(checkoutData, basket)) return null;

    // calculate ProductLineItems tax discount
    var checkoutLineItems = checkoutData.items;
    var aggregateBasketPriceItem;
    var adjustedValue;

    var productTaxDiscount = basket.getProductLineItems()
        .toArray()
        .reduce(function (sum, productItem) {
            var checkoutItem = checkoutLineItems.find(function (item) { // eslint-disable-line no-loop-func
                return productItem.custom.digitalRiverID === item.digitalRiverID;
            });

            aggregateBasketPriceItem = checkoutHelper.getAggregatePriceItem(productItem, basket.currencyCode);
            adjustedValue = (checkoutItem.amount + checkoutItem.tax.amount) - aggregateBasketPriceItem.value;

            return (Math.abs(adjustedValue) < 0.01) ? sum : sum + adjustedValue;
        }, 0);

    // calculate ShippingLineItems tax discount
    var shipment = basket.shipments[0];
    aggregateBasketPriceItem = shipment.getShippingLineItems()
        .toArray()
        .reduce(function (sum, shippingItem) {
            return shippingItem.getID().indexOf('digitalRiver_') > -1 ? sum.subtract(shippingItem.adjustedPrice) : sum;
        }, shipment.getAdjustedShippingTotalPrice());
    adjustedValue = (checkoutData.shippingAmount + checkoutData.shippingTax) - aggregateBasketPriceItem.value;

    if (Math.abs(adjustedValue) >= 0.01) {
        productTaxDiscount += adjustedValue;
    }

    return productTaxDiscount;
}

module.exports = {
    TAX_ADJUSTMENT: TAX_ADJUSTMENT,
    FEES_ADJUSTMENT: FEES_ADJUSTMENT,
    isDrAdjustment: isDrAdjustment,
    saveCheckoutDataToBasket: saveCheckoutDataToBasket,
    parseCheckoutData: parseCheckoutData,
    checkoutDataIsValid: checkoutDataIsValid,
    resetBasketCheckoutData: resetBasketCheckoutData,
    updateCheckoutDataInBasket: updateCheckoutDataInBasket,
    isImporterOfRecordTax: isImporterOfRecordTax,
    getComplianceEntity: getComplianceEntity,
    getTaxExemptData: getTaxExemptData,
    updateTaxPromotion: updateTaxPromotion,
    getTaxDiscount: getTaxDiscount
};
