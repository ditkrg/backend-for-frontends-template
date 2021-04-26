"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config = require(process.env.CONFIGURATIONS_FILE_PATH || "./config.temp.json");
exports.configure = function () {
    return config;
};
