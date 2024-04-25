'use strict';

/**
 * Controller for accepting and processing DigitalRiver webhooks
 */
function Debug() {
    var logger = require('dw/system/Logger');
    var drHooksHandler = require('*/cartridge/scripts/digitalRiver/hooksObserver/drHooksHandlers');
    var drHooksHelper = require('*/cartridge/scripts/digitalRiver/hooksObserver/drHooksHelper');

    // get the hook data
    var drSignature = request.getHttpHeaders().get('digitalriver-signature') || '';
    var requestBodyAsString = request.httpParameterMap.getRequestBodyAsString() || '{}';
    var hook = JSON.parse(requestBodyAsString);
    var hookType = hook.type ? hook.type : 'error';
    var hookHandlerResponse;
    var checkSignature = drHooksHelper.checkSignature(drSignature, requestBodyAsString);

    // log info
    var DRLogger = logger.getLogger('drWebhooks', hookType); // hook type, e.g. refund.pending
    DRLogger.info(requestBodyAsString);

    // check signature
    if (checkSignature.error) {
        hookType = 'error';
        DRLogger.error(checkSignature.errorMessage);
        // handle hook with error log
        hookHandlerResponse = drHooksHandler.default(hookType, hook.data);
    } else if (drHooksHandler[hookType]) { // signature is ok, handle hooks
        hookHandlerResponse = drHooksHandler[hookType](hook.data);
    } else {
        hookHandlerResponse = drHooksHandler.default(hookType, hook.data);
    }

    // response
    response.setStatus(hookHandlerResponse.statusCode);
}

exports.Debug = Debug;
exports.Debug.public = true;
