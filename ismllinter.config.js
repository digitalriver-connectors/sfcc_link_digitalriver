'use strict';

// Please check all available configurations and rules
// at https://www.npmjs.com/package/isml-linter.

var config = {
    ignore: [
        'customercredit-ui-mockup/cartridges/customercredit_ui_mockup/cartridge/templates/default/checkout/billing/billing.isml',
        'cartridges/int_digitalriver_sfra/cartridge/templates/default/checkout/billing/billing.isml',
        'cartridges/digitalriver_test/cartridge/templates/default/common/scripts.isml'
    ],
    enableCache: true,
    rules: {
        'no-space-only-lines': {},
        'no-tabs': {},
        'no-trailing-spaces': {}
    }
};

module.exports = config;
