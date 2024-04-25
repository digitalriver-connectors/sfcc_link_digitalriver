/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (function() { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./cartridges/bm_digitalriver/cartridge/client/default/js/testServices.js":
/*!********************************************************************************!*\
  !*** ./cartridges/bm_digitalriver/cartridge/client/default/js/testServices.js ***!
  \********************************************************************************/
/***/ (function() {

eval("\n\njQuery.noConflict();\n\n/**\n * Test services\n *\n * @param {Object} $ Jquery object\n */\nfunction testServices($) {\n    $('.test-service').on('click', function (e) {\n        e.preventDefault();\n        var url = $('.test-service').data('url');\n        $('.sku-result').text('waiting');\n        $('.checkout-result').text('waiting');\n        $('.customer-result').text('waiting');\n        $.ajax({\n            url: url,\n            success: function (res) {\n                $('.sku-result').text(res.response.sku);\n                $('.checkout-result').text(res.response.checkout);\n                $('.customer-result').text(res.response.customer);\n            },\n            error: function (res) {\n                $('.drbm-error-info').text('Error while testing services: ' + res.status + ' ' + res.statusText);\n            }\n        });\n    });\n}\n\njQuery(document).ready(function ($) { // eslint-disable-line no-undef\n    testServices($);\n});\n\n\n//# sourceURL=webpack://int_digitalriver_sfra/./cartridges/bm_digitalriver/cartridge/client/default/js/testServices.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./cartridges/bm_digitalriver/cartridge/client/default/js/testServices.js"]();
/******/ 	
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdFxcanNcXHRlc3RTZXJ2aWNlcy5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O1VDQUE7VUFDQTtVQUNBO1VBQ0E7VUFDQSIsInNvdXJjZXMiOlsid2VicGFjazovLy93ZWJwYWNrL2JlZm9yZS1zdGFydHVwIiwid2VicGFjazovLy93ZWJwYWNrL3N0YXJ0dXAiLCJ3ZWJwYWNrOi8vL3dlYnBhY2svYWZ0ZXItc3RhcnR1cCJdLCJzb3VyY2VzQ29udGVudCI6WyIiLCIvLyBzdGFydHVwXG4vLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbi8vIFRoaXMgZW50cnkgbW9kdWxlIGNhbid0IGJlIGlubGluZWQgYmVjYXVzZSB0aGUgZXZhbCBkZXZ0b29sIGlzIHVzZWQuXG52YXIgX193ZWJwYWNrX2V4cG9ydHNfXyA9IHt9O1xuX193ZWJwYWNrX21vZHVsZXNfX1tcIi4vY2FydHJpZGdlcy9ibV9kaWdpdGFscml2ZXIvY2FydHJpZGdlL2NsaWVudC9kZWZhdWx0L2pzL3Rlc3RTZXJ2aWNlcy5qc1wiXSgpO1xuIiwiIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9