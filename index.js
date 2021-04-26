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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
var fastify = require('fastify');
var fastifyCookie = require('fastify-cookie');
var proxy = require('fastify-http-proxy');
var hyperid = require('hyperid');
var uuid = hyperid();
var configure = require('./configurations').configure;
var _a = require('openid-client'), generators = _a.generators, custom = _a.custom, Issuer = _a.Issuer;
var config = configure();
var server = fastify({
    logger: true
});
custom.setHttpOptionsDefaults({
    timeout: config.proxy.httpTimeout || 10000,
});
var issuer = null;
var client = null;
var code_verifier = null;
Issuer.discover('https://dev.auth.digital.gov.krd/.well-known/openid-configuration')
    .then(function (openIDResponse) { return client = new openIDResponse.Client({
    client_id: 'bff-test',
    client_secret: '3a0f622eedf34f00997eae89dd63c13f',
    redirect_uris: ['http://localhost:3002/callback'],
    response_types: ['code'],
}); })
    .catch(function (e) { return console.log("Shit Happened", { e: e }); });
server.register(fastifyCookie, {
    secret: config.cookie.secret,
    parseOptions: config.cookie.parseOptions || {}
});
server.get("/login", function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var code_challenge, authorizationURL;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                code_verifier = generators.codeVerifier();
                code_challenge = generators.codeChallenge(code_verifier);
                return [4 /*yield*/, client.authorizationUrl({
                        scope: 'openid profile offline_access',
                        code_challenge: code_challenge,
                        code_challenge_method: 'S256',
                    })];
            case 1:
                authorizationURL = _a.sent();
                console.log({
                    authorizationURL: authorizationURL
                });
                reply.redirect(authorizationURL);
                return [2 /*return*/];
        }
    });
}); });
server.get("/callback", function (request, reply) {
    var params = client.callbackParams(request);
    console.log({ params: params });
    client.callback('http://localhost:3002/callback', params, { code_verifier: code_verifier }) // => Promise
        .then(function (tokenSet) {
        var refresh_token = tokenSet.refresh_token;
        console.log({
            refresh_token: refresh_token
        });
        reply.setCookie('token', refresh_token, {
            domain: config.cookie.domain,
            path: config.cookie.path,
            sameSite: true,
            httpOnly: true,
            signed: true
        });
        reply.redirect("/");
    });
});
server.register(proxy, {
    upstream: config.proxy.upstream,
    prefix: config.proxy.prefix || "",
    http2: config.proxy.enableHTTP2 || false,
    replyOptions: {
        rewriteRequestHeaders: function (originalReq, headers) { return (__assign(__assign({}, headers), { 'request-id': uuid() })); }
    }
});
console.log("REQUEST LOGGED");
server.listen(3002);
