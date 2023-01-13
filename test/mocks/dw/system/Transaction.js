var Transaction = function () {};

Transaction.begin = function () {};
Transaction.commit = function () {};
Transaction.rollback = function () {};
Transaction.wrap = function (callback) {
    callback();
};

module.exports = Transaction;
