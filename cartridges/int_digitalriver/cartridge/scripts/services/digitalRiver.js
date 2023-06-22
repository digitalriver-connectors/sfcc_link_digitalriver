'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Site = require('dw/system/Site');
var UUIDUtils = require('dw/util/UUIDUtils');
var System = require('dw/system/System');
var logger = require('*/cartridge/scripts/digitalRiver/drLogger').getLogger('');
var logHelper = require('*/cartridge/scripts/services/logHelper');

/**
 * Creates a request object to be used when calling the service. Default implementation for Digital River service
 * @param {dw.svc.HTTPService} svc Service being executed.
 * @param {Object} args Parameters given to the call method.
 * @returns {string} request body
 */
function defaultCreateRequest(svc, args) {
    svc.addHeader('Content-Type', 'application/json');
    svc.addHeader('Accept', 'application/json');
    svc.setAuthentication('NONE');
    var drAPIKey = Site.current.preferences ? Site.current.getCustomPreferenceValue('drAPIKey') : System.getPreferences().getCustom().drAPIKey;
    svc.addHeader('Authorization', 'Bearer ' + drAPIKey);
    return JSON.stringify(args);
}
/**
 * Creates a response object from a successful service call. Default implementation for Digital River service
 * @param {dw.svc.Service} svc Service being executed.
 * @param {Object} response service response
 * @returns {Object} response object
 */
function defaultParseResponse(svc, response) {
    switch (response.statusCode) {
        case 200: // reserved for implementation
        case 201: // reserved for implementation
        default:
            try {
                return JSON.parse(response.text);
            } catch (e) {
                return {
                    error: true,
                    errorMsg: 'Unable to parse response object ' + response.text,
                    responseStr: response.text
                };
            }
    }
}

/**
 * Allows filtering communication URL, request, and response log messages.
 * @param {string} msg incoming log message
 * @returns {string} filtered message
 */
function defaultFilterLogMessage(msg) {
    return logHelper.maskedPrivateData(msg, 'email');
}

/**
 * Adds debugging headers to the service
 * @param {dw.svc.Service} svc service being executed
 * @returns {void}
*/
function addDebuggingHeaders(svc) {
    var drVersion = require('*/cartridge/version.json').version;
    var uuid = UUIDUtils.createUUID();
    svc.addHeader('upstream-id', uuid);
    svc.addHeader('upstream-application-id', 'SFCC' + drVersion + System.compatibilityMode);
    logger.debug('Added debugging headers: upstream-id:{0}, upstream-application-id:{1}', uuid, 'SFCC' + drVersion + System.compatibilityMode);

    if (!request.custom.isJobRequest) {
        var ipAddress = request.httpHeaders.get('true-client-ip') || request.getHttpRemoteAddress();
        svc.addHeader('upstream-session-id', session.getSessionID()); // eslint-disable-line no-undef
        svc.addHeader('forwarded', 'for=' + ipAddress);
        logger.debug('Added debugging headers: upstream-session-id:{0}, forwarded:{1}', session.getSessionID(), 'for=' + ipAddress); // eslint-disable-line no-undef
    }
}

/**
 * Basic service creation with some default callback implementations to avoid code duplicates
 * @param {string} relativePath url path to Digital River endpoint
 * @param {Object} serviceConfig Configuration callback.
 * @returns {dw.svc.HTTPService} initiated service
 */
function createDigitalRiverService(relativePath, serviceConfig) {
    var endpointPath = relativePath || ''; // default value
    if (endpointPath && endpointPath.charAt(0) !== '/') {
        endpointPath = '/' + endpointPath;
    }
    serviceConfig = serviceConfig || {}; // eslint-disable-line no-param-reassign

    serviceConfig.createRequest = serviceConfig.createRequest || defaultCreateRequest; // eslint-disable-line no-param-reassign
    serviceConfig.parseResponse = serviceConfig.parseResponse || defaultParseResponse; // eslint-disable-line no-param-reassign
    serviceConfig.filterLogMessage = serviceConfig.filterLogMessage || defaultFilterLogMessage; // eslint-disable-line no-param-reassign

    var svc = LocalServiceRegistry.createService('DigitalRiver.http.service', serviceConfig);

    var path = svc.getURL() + endpointPath;
    svc.setURL(path);
    addDebuggingHeaders(svc);

    return svc;
}

/**
 * @param {object} drServicePath  - url path to Digital River endpoint
 * @param {object} body - Passing request body
 * @param {boolean} isBody - check request body includes data
 * @returns return the oject
 */
function drServiceRetryLogic(drServicePath, body, isBody) {
    var counterLimit = require('*/cartridge/customData.json').retryLogicCount;
    var counter = 0;
    var callResult;
    do {
        if (isBody) {
            callResult = drServicePath.call(body);
        } else {
            callResult = drServicePath.call();
        }
        if (callResult.ok) {
            break;
        }
        logger.info('Retrying the API call due to failure : Response Code {0} Response Message {1}', callResult.error, callResult.errorMessage);
        counter++;
    } while (callResult.error >= 500 && callResult.error < 600 && counter < counterLimit);
    if (callResult.error < 500 || callResult.error >= 600) {
        logger.error('ERROR::>> ', JSON.stringify(callResult.errorMessage));
    }
    return callResult;
}

module.exports = {
    createDigitalRiverService: createDigitalRiverService,
    drServiceRetryLogic: drServiceRetryLogic
};
