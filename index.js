"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
var Fastify = require('fastify');
var server = Fastify();
var proxy = require('fastify-http-proxy');
var hyperid = require('hyperid');
var uuid = hyperid();
var configure = require('./configurations').configure;
configure();
server.register(proxy, {
    upstream: "http://localhost:3001",
    prefix: 'frps',
    http2: false,
    replyOptions: {
        rewriteRequestHeaders: function (originalReq, headers) { return (__assign(__assign({}, headers), { 'request-id': uuid() })); }
    }
});
server.listen(3002);
