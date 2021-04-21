"use strict";
var config = require(process.env.CONFIGURATIONS_FILE_PATH || "./config.temp.json");
exports.configure = function () {
    console.log({
        config: config
    });
};
