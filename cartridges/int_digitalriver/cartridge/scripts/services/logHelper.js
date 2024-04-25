'use strict';

/**
 * Get masked Email
 * @param {string} email - Email
 * @returns {string} - masked Email
 */
function getMaskedEmail(email) {
    var masked = '';
    var prefix = email.slice(0, email.lastIndexOf('@'));
    var postfix = email.slice(email.lastIndexOf('@'));

    for (var i = 0; i < prefix.length; i += 1) {
        if (i === 0 || i === prefix.length - 1) {
            masked += prefix[i].toString();
        } else {
            masked += '*';
        }
    }
    return masked + postfix;
}

/**
 * Function masked private data in Object
 * @param {Object} include - data object
 * @param {string} field - the name of the field whose data should be masked
 * @returns {Object} - Object with masked private data
 */
function maskedField(include, field) {
    var result = include;
    if (typeof include === 'object') {
        Object.keys(include).forEach(function (key) {
            if (typeof include[key] === 'object' && include[key] !== null) {
                maskedField(include[key], field);
            } else if (key === field && field === 'email') {
                result[key] = getMaskedEmail(result[key]);
            }
        });
    }
    return result;
}

/**
 * Function masked private data in Object
 * @param {string} msg - Object as string
 * @param {string} field - the name of the field whose data should be masked
 * @returns {string} - Object as string with masked private data
 */
function maskedPrivateData(msg, field) {
    var result = msg;
    var obj = null;
    try {
        obj = JSON.parse(msg);
    } catch (error) {
        obj = null;
    }
    if (obj) {
        var resultObj = maskedField(obj, field);
        result = JSON.stringify(resultObj);
    }
    return result;
}

module.exports = {
    getMaskedEmail: getMaskedEmail,
    maskedPrivateData: maskedPrivateData
};
