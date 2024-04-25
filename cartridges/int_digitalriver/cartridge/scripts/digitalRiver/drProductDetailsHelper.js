/* eslint-disable require-jsdoc */

'use strict';

const URLUtils = require('dw/web/URLUtils');
const ArrayList = require('dw/util/ArrayList');

function getNewPath(category, oldPath) {
    let path = oldPath || '';
    return (path.length === 0) ? category.displayName : category.displayName + ' > ' + path;
}

function getCategoryPath(category, path) {
    if (category.topLevel) {
        return getNewPath(category, path);
    }
    return getCategoryPath(category.parent, getNewPath(category, path));
}

function getAllCategoryPaths(product) {
    let catList = new ArrayList();
    for (var c = 0; c < product.categories.length; c += 1) {
        let cat = getCategoryPath(product.categories[c]);
        catList.add(cat);
    }
    return catList.join(';');
}

function getProductTaxDesc(product, chars) {
    let maxChars = chars || 1000;
    let drTaxDescription = product.custom.drTaxDescription || '';
    return drTaxDescription.substring(0, maxChars);
}

function getProductItemBreadcrumb(product) {
    let drTaxItemBreadcrumb = product.custom.drTaxItemBreadcrumb || '';
    return (drTaxItemBreadcrumb.length !== 0) ? drTaxItemBreadcrumb : getAllCategoryPaths(product);
}

function getProductUrl(productID) {
    return URLUtils.abs('Product-Show', 'pid', productID).toString();
}

function getProductImageUrl(product) {
    return product.getImage('small').getAbsURL().toString();
}

function sendProductDetails(product) {
    var productDetails = {
        countryOfOrigin: product.custom.drCountryOfOrigin,
        name: product.name,
        id: product.ID
    };

    var additionalAttributes = {
        weight: product.custom.drWeight ? Number(product.custom.drWeight.toFixed(4)) : null,
        weightUnit: product.custom.drWeight ? (product.custom.drWeightUnit.value || 'oz') : null,
        skuGroupId: product.custom.drSkuGroupId,
        description: getProductTaxDesc(product),
        itemBreadcrumb: getProductItemBreadcrumb(product),
        image: getProductImageUrl(product),
        url: getProductUrl(product.ID)
    };

    Object.keys(additionalAttributes).forEach(function (key) {
        if (!empty(additionalAttributes[key])) {
            productDetails[key] = additionalAttributes[key];
        }
    });
    return productDetails;
}

module.exports = {
    getProductTaxDesc: getProductTaxDesc,
    getProductItemBreadcrumb: getProductItemBreadcrumb,
    getProductUrl: getProductUrl,
    getProductImageUrl: getProductImageUrl,
    sendProductDetails: sendProductDetails
};
