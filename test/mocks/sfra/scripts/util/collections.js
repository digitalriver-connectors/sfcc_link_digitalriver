'use strict';

module.exports.forEach = function (collection, callback) {
    collection.forEach(callback);
};

module.exports.map = function (collection, callback) {
    return collection.map(callback);
};

module.exports.find = function (collection, callback) {
    return collection.find(callback);
};
