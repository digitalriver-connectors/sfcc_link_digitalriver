'use strict';

var URLUtils = require('dw/web/URLUtils');

var styles = [];

module.exports = {
    addCss: function (src) {
        if (/((http(s)?:)?\/\/).*.css/.test(src)) {
            if (styles.lastIndexOf(src) < 0) {
                styles.push(src);
            }
        } else if (styles.lastIndexOf(URLUtils.staticURL(src).toString()) < 0) {
            styles.push(URLUtils.staticURL(src).toString());
        }
    },
    styles: styles
};
