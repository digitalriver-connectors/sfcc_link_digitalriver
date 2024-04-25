'use strict';

var File = require('dw/io/File');
var FileReader = require('dw/io/FileReader');
var XMLStreamReader = require('dw/io/XMLStreamReader');
var XMLStreamConstants = require('dw/io/XMLStreamConstants');
var XMLIndentingStreamWriter = require('dw/io/XMLIndentingStreamWriter');
var FileWriter = require('dw/io/FileWriter');
var Site = require('dw/system/Site');
var currentSite = Site.getCurrent();
var DynamicPricingService = require('*/cartridge/scripts/services/digitalRiverDynamicPricing');
var Status = require('dw/system/Status');

/**
 * Writes the price table for the given products and quantities
 * @param {XMLStreamWriter} xsw - the XMLStreamWriter object
 * @param {Array} products - an array of product objects
 * @param {Array} quantities - an array of quantity objects
 * @param {string} priceNaming - the name of the price attribute
 */
function writePriceTable(xsw, products, quantities) {
    for (var i = 0; i < products.length; i += 1) {
        if (i === 0 || products[i].id !== products[i - 1].id) {
            xsw.writeStartElement('price-table');
            xsw.writeAttribute('product-id', products[i].id);
        }
        xsw.writeStartElement('amount');
        xsw.writeAttribute('quantity', quantities[i]);
        xsw.writeCharacters(products[i].calculatedPrice);
        xsw.writeEndElement();
        if (i === products.length - 1 || products[i].id !== products[i + 1].id) {
            xsw.writeEndElement();
        }
    }
}

/**
* Retrieves dynamic pricing data and exports it to an XML file
* @param {string} baseFile - the base file name for dynamic pricing
* @param {string} exportFolder - the folder to export the dynamic pricing XML file
* @param {string} country - the country code for dynamic pricing data
* @param {string} currency - the currency code for dynamic pricing data
* @param {string} namePattern - the pattern for the export file name
* @param {string} basePattern - the base pattern for dynamic pricing
* @throws {Error} if unexpected parameter type is encountered
* @returns {dw.system.Status} the status of the export process
*/
function getDynamicPricing(baseFile, exportFolder, country, currency, namePattern, basePattern) {  //eslint-disable-line
    if (typeof currency !== 'string' || typeof country !== 'string') {
        throw new Error('Unexpected parameter type');
    }
    var exportFileName = namePattern.replace('{COUNTRY}', country).replace('{CURRENCY}', currency);
    var readfile = new File(File.IMPEX + File.SEPARATOR + 'src' + File.SEPARATOR + baseFile + '.xml');
    if (!readfile.exists()) {
        return new Status(Status.ERROR, null, 'Base file does not exist');
    }
    var exportFolderFile = new File(File.IMPEX + File.SEPARATOR + 'src' + File.SEPARATOR + exportFolder);
    if (!exportFolderFile.exists()) {
        exportFolderFile.mkdirs();
    }
    var writeFile = new File(File.IMPEX + File.SEPARATOR + 'src' + File.SEPARATOR + exportFolder + File.SEPARATOR + exportFileName + '.xml');
    var fileReader = new FileReader(readfile);
    var xsr = new XMLStreamReader(fileReader);
    var fileWriter = new FileWriter(writeFile);
    var xsw = new XMLIndentingStreamWriter(fileWriter);
    var batchSize = currentSite.getCustomPreferenceValue('drBatchSize');

    var products = [];
    var quantities = [];
    var product = {};
    var amounts = [];
    xsw.writeStartDocument();
    xsw.writeStartElement('pricebooks');
    xsw.writeAttribute('xmlns', 'http://www.demandware.com/xml/impex/pricebook/2006-10-31');
    xsw.writeStartElement('pricebook');
    xsw.writeStartElement('header');
    xsw.writeAttribute('pricebook-id', exportFileName);
    xsw.writeStartElement('currency');
    xsw.writeCharacters(currency);
    xsw.writeEndElement();
    xsw.writeStartElement('online-flag');
    xsw.writeCharacters(true);
    xsw.writeEndElement();
    if (basePattern) {
        xsw.writeStartElement('parent');
        xsw.writeCharacters(basePattern.replace('{COUNTRY}', country).replace('{CURRENCY}', currency));
        xsw.writeEndElement();
    }
    xsw.writeEndElement();
    xsw.writeStartElement('price-tables');

    var result;
    while (xsr.hasNext()) {
        var eventType = xsr.next();
        if (eventType === XMLStreamConstants.START_ELEMENT) {
            if (
                xsr.getLocalName() === 'price-table'
                && xsr.getAttributeValue(null, 'product-id')
            ) {
                product.id = xsr.getAttributeValue(null, 'product-id');
            }
            if (
                xsr.getLocalName() === 'amount'
                && xsr.getAttributeValue(null, 'quantity')
            ) {
                amounts.push({ quantity: xsr.getAttributeValue(null, 'quantity'), price: xsr.readXMLObject().toString() });
            }
        } else if (eventType === XMLStreamConstants.END_ELEMENT && xsr.getLocalName() === 'price-table') {
            for (var i = 0; i < amounts.length; i += 1) {
                products.push({ id: product.id, price: amounts[i].price });
                quantities.push(amounts[i].quantity);
            }

            amounts = [];
            product = {};

            if (products.length === batchSize) {
                result = DynamicPricingService.convertDynamicPricing({
                    countryCode: country,
                    currencyCode: currency,
                    prices: products
                });
                if (result.status === 'OK') {
                    writePriceTable(xsw, result.object.prices, quantities);
                    products = [];
                    quantities = [];
                } else {
                    return new Status(Status.ERROR, null, 'error {0}', result.object);
                }
            }
        }
    }
    if (products.length > 0) {
        result = DynamicPricingService.convertDynamicPricing({
            countryCode: country,
            currencyCode: currency,
            prices: products
        });
        if (result.status === 'OK') {
            writePriceTable(xsw, result.object.prices, quantities);
        } else {
            return new Status(Status.ERROR, null, 'error {0}', result.object);
        }
    }
    xsw.writeEndElement();
    xsw.writeEndElement();
    xsw.writeEndElement();
    xsw.writeEndDocument();
    xsw.close();
    xsr.close();
    fileReader.close();
    fileWriter.close();
}

module.exports = {
    getDynamicPricing: getDynamicPricing
};
