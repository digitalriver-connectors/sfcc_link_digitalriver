'use strict';

var server = require('server');

var URLUtils = require('dw/web/URLUtils');
var Resource = require('dw/web/Resource');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');

/**
 * Get array of Digital River customer Tax Certificate
 * @param {string} drCustomerId -Digital River customer ID
 * @returns {array} - Digital River customer Tax Certificate array
 */
function getTaxCertificateList(drCustomerId) {
    var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
    var drUtilsHelper = require('*/cartridge/scripts/digitalRiver/drUtilsHelper');
    var drTaxCertificates = null;
    if (!empty(drCustomerId)) {
        var drResponse = drCustomerAPI.getCustomerById(drCustomerId);
        if (drResponse && drResponse.taxCertificates) {
            drTaxCertificates = drResponse.taxCertificates.map(function (certificate) {
                return {
                    fileId: certificate.fileId,
                    companyName: certificate.companyName,
                    taxAuthority: certificate.taxAuthority,
                    startDate: drUtilsHelper.drDateToLocal(certificate.startDate),
                    endDate: drUtilsHelper.drDateToLocal(certificate.endDate)
                };
            });
        }
    }
    return drTaxCertificates;
}

server.get('List',
    userLoggedIn.validateLoggedIn,
    function (req, res, next) {
        var customerHelper = require('*/cartridge/scripts/digitalRiver/drCustomerHelper');
        var drCustomerId = req.currentCustomer.raw.profile.custom.globalCommerceCustID;
        var customerResult = customerHelper.checkDrCustomer(req.currentCustomer.raw.profile);

        res.render('digitalriver/account/drTaxCertificateList', {
            drCustomerError: customerResult.drCustomerError,
            taxCertificates: getTaxCertificateList(drCustomerId),
            actionUrl: URLUtils.url('TaxCertificates-DeletePayment').toString(),
            breadcrumbs: [
                {
                    htmlValue: Resource.msg('global.home', 'common', null),
                    url: URLUtils.home().toString()
                },
                {
                    htmlValue: Resource.msg('page.title.myaccount', 'account', null),
                    url: URLUtils.url('Account-Show').toString()
                }
            ]
        });
        next();
    }
);

server.get('AddCertificate',
    csrfProtection.generateToken,
    userLoggedIn.validateLoggedIn,
    function (req, res, next) {
        var customerHelper = require('*/cartridge/scripts/digitalRiver/drCustomerHelper');
        var customerResult = customerHelper.checkDrCustomer(req.currentCustomer.raw.profile);
        var certificateForm = server.forms.getForm('taxCertificate');
        certificateForm.clear();

        res.render('digitalriver/account/addCertificate', {
            drCustomerError: customerResult.drCustomerError,
            certificateForm: certificateForm,
            accountlanding: true,
            breadcrumbs: [
                {
                    htmlValue: Resource.msg('global.home', 'common', null),
                    url: URLUtils.home().toString()
                },
                {
                    htmlValue: Resource.msg('page.title.myaccount', 'account', null),
                    url: URLUtils.url('Account-Show').toString()
                },
                {
                    htmlValue: Resource.msg('label.taxcertificate', 'digitalriver', null),
                    url: URLUtils.url('TaxCertificates-List').toString()
                }
            ]
        });
        next();
    }
);

server.post('SaveCertificate',
    csrfProtection.validateAjaxRequest,
    userLoggedIn.validateLoggedInAjax,
    function (req, res, next) {
        var data = res.getViewData();
        if (data && !data.loggedin) {
            res.json();
            return next();
        }

        var File = require('dw/io/File');
        var drCustomerAPI = require('*/cartridge/scripts/services/digitalRiverCustomer');
        var formErrors = require('*/cartridge/scripts/formErrors');
        var drUtilsHelper = require('*/cartridge/scripts/digitalRiver/drUtilsHelper');

        var certificateForm = server.forms.getForm('taxCertificate');
        var drCustomerId = req.currentCustomer.raw.profile.custom.globalCommerceCustID;

        if (!certificateForm.valid || !drCustomerId) {
            res.json({
                success: false,
                fields: formErrors.getFormErrors(certificateForm)
            });
            return next();
        }

        // Upload image of Tax Certificate to temporary folder
        var wrongFileExtension = false;
        var filesInput = request.httpParameterMap.processMultipart(function (field, ct, oname) {
            // Check file extension
            var idx = oname ? oname.lastIndexOf('.') : -1;
            var fileExt = idx < 0 ? '' : oname.slice(++idx);
            if (['gif', 'jpg', 'pdf'].indexOf(fileExt) === -1) {
                wrongFileExtension = true;
                return null;
            }

            var timeStamp = Date.now().toString();
            return new File(File.TEMP + File.SEPARATOR + 'DR_' + timeStamp + '_' + oname);
        });

        // Send image of Tax Certificate to Digital River
        var file = filesInput.get(certificateForm.imageFile.htmlName);

        if (empty(file)) {
            res.json({
                success: false,
                errorMessage: wrongFileExtension
                    ? Resource.msg('msg.error.file.extension', 'digitalriver', null)
                    : Resource.msg('msg.error.file.upload', 'digitalriver', null)
            });
            return next();
        }

        var payload = {
            file: file,
            purpose: 'tax_document_customer_upload', // 'TAX_DOCUMENT_FILE_PURPOSE'
            fileName: file.getName()
        };

        var drResponse = null;
        try {
            drResponse = drCustomerAPI.createFile(payload);
        } catch (error) {
            drResponse = null;
        }

        if (!drResponse || !drResponse.id) {
            file.remove();
            res.json({
                success: false,
                errorMessage: Resource.msg('msg.error.file.upload', 'digitalriver', null)
            });
            return next();
        }

        // Update Customer data
        payload = {
            taxCertificate: {
                companyName: certificateForm.companyName.value,
                taxAuthority: certificateForm.states.stateCode.value,
                fileId: drResponse.id,
                startDate: certificateForm.startDate.htmlValue + 'T00:00:00Z',
                endDate: certificateForm.endDate.htmlValue + 'T23:59:00Z'
            }
        };

        try {
            drResponse = drCustomerAPI.updateCustomer(drCustomerId, payload);
        } catch (error) {
            drResponse = null;
        }

        if (!drResponse || !drResponse.ok) {
            file.remove();
            res.json({
                success: false,
                errorMessage: Resource.msg('msg.error.add.sertificate', 'digitalriver', null) + ' ' + drUtilsHelper.getErrorMesseges(drResponse)
            });
            return next();
        }

        // Remove Tax Certificate file from temporary folder
        file.remove();

        res.json({
            success: true,
            redirectUrl: URLUtils.url('TaxCertificates-List').toString()
        });
        return next();
    }
);

server.get('CertificateList',
    userLoggedIn.validateLoggedInAjax,
    function (req, res, next) {
        var data = res.getViewData();
        if (data && !data.loggedin) {
            res.json();
            return next();
        }

        var Template = require('dw/util/Template');
        var HashMap = require('dw/util/HashMap');
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var BasketMgr = require('dw/order/BasketMgr');
        var Locale = require('dw/util/Locale');
        var OrderModel = require('*/cartridge/models/order');
        var drTaxHelper = require('*/cartridge/scripts/digitalRiver/drTaxHelper');
        var drCheckoutAPI = require('*/cartridge/scripts/services/digitalRiverCheckout');

        var drCustomerId = req.currentCustomer.raw.profile.custom.globalCommerceCustID;
        var drTaxCertificates = getTaxCertificateList(drCustomerId);

        var reqRedirectUrl = 'https://' + req.host; // adding code to get the hostname


        var context = new HashMap();
        context.put('digitalRiverTaxCertificate', drTaxCertificates);

        // Recalculate Backet
        var currentBasket = BasketMgr.getCurrentBasket();
        var drCustomerType = req.querystring.customer_type;
        var checkoutId = currentBasket.custom.drCheckoutID;
        var digitalRiverConfiguration = null;

        var newCheckout = (req.querystring.stage === 'new')
            ? drCheckoutAPI.createCheckout(currentBasket, drCustomerType)
            : drCheckoutAPI.updateCheckout(checkoutId, { customerType: drCustomerType });

        if (newCheckout.ok) {
            drTaxHelper.saveCheckoutDataToBasket(newCheckout.object, currentBasket);
            COHelpers.recalculateBasket(currentBasket);

            var dropinHelper = require('*/cartridge/scripts/digitalRiver/dropinHelper');
            var currentSite = require('dw/system/Site').getCurrent();

            digitalRiverConfiguration = {
                currentLocaleId: req.locale.id.replace('_', '-'),
                APIKey: currentSite.getCustomPreferenceValue('drPublicKey'),
                dropInConfiguration: dropinHelper.getConfiguration({
                    basket: BasketMgr.getCurrentBasket(),
                    customer: req.currentCustomer.raw,
                    reqUrl: reqRedirectUrl  // adding host name
                }),
                cancelRedirectUrl: URLUtils.url('Checkout-Begin', 'stage', 'payment').toString()
            };
        }

        var currentLocale = Locale.getLocale(req.locale.id);

        res.json({
            order: new OrderModel(currentBasket, { countryCode: currentLocale.country, containerView: 'basket' }),
            renderedTemplate: new Template('digitalriver/certificate/drTaxCertificateTable').render(context).text,
            digitalRiverConfiguration: digitalRiverConfiguration
        });
        return next();
    }
);


module.exports = server.exports();
