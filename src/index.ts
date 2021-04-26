import { FastifyReply, FastifyRequest } from "fastify";
import { IncomingHttpHeaders } from "node:http";
import { Configurable } from "./types";

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const fastify = require('fastify');
const fastifyCookie = require('fastify-cookie');
const proxy   = require('fastify-http-proxy')

const hyperid = require('hyperid')
const uuid = hyperid()
const { configure } = require('./configurations')
const { generators, custom, Issuer } = require('openid-client');

const config : Configurable = configure();
const server  = fastify({
    logger: true
});

custom.setHttpOptionsDefaults({
    timeout: config.proxy.httpTimeout || 10000,
});


let issuer : any = null;
let client : any = null;
let code_verifier : any = null;

const callbackWithHost = `${config.host}/${config.auth.redirect_endpoint}`

Issuer.discover(config.auth.openidc_discovery_uri)
.then((openIDResponse : any) => client = new openIDResponse.Client({
        client_id: config.auth.client_id,
        client_secret: config.auth.client_secret,
        redirect_uris: [callbackWithHost],
        response_types: ['code'],
    }))
.catch((e : any) => console.error("Error occurred while trying to discover the Open ID Connect Configurations", {e}))


server.register(fastifyCookie, {
    secret: config.cookie.secret,
    parseOptions: config.cookie.parseOptions || {}
})

server.get("/login", async (request : FastifyRequest, reply: FastifyReply) => {
    code_verifier = generators.codeVerifier();
    // store the code_verifier in your framework's session mechanism, if it is a cookie based solution
    // it should be httpOnly (not readable by javascript) and encrypted.

    const code_challenge = generators.codeChallenge(code_verifier);

    const authorizationURL = await client.authorizationUrl({
        scope: 'openid profile offline_access',
        code_challenge,
        code_challenge_method: 'S256',
    });
    
    console.log(`Authorization code request was sent to the Authorization Server. URL: ${authorizationURL}`)

    reply.redirect(authorizationURL)
})

server.get("/callback", (request : FastifyRequest, reply: any) => {
    const params = client.callbackParams(request);
    console.log({params})
    client.callback(callbackWithHost, params, { code_verifier }) // => Promise
    .then(function (tokenSet : any) {
        const { refresh_token } = tokenSet;
        console.log({
            refresh_token
        })
        reply.setCookie('token', refresh_token, {
            domain: config.cookie.domain,
            path: config.cookie.path,
            sameSite: true,
            httpOnly: true,
            signed: true
        })
    
        reply.redirect("/");
    });

    
});

server.register(proxy, {
    upstream: config.proxy.upstream,
    prefix: config.proxy.prefix || "",
    http2: config.proxy.enableHTTP2 || false ,
    replyOptions: {
        rewriteRequestHeaders: (originalReq : IncomingHttpHeaders, headers : any) => ({
            ...headers, 
            'request-id': uuid()
        })
    }
})

console.log(`Listening on PORT: ${process.env.PORTs}`)
server.listen(process.env.PORT)