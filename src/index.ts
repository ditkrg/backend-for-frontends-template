import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { IncomingHttpHeaders } from "node:http";
import { RedisClient, RedisError } from "redis";
import { Configurable } from "./types";

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const fastify           = require('fastify');
const fastifyCookie     = require('fastify-cookie');
const fastifyHealtCheck = require('fastify-healthcheck');
const fastifyStatus     = require('fastify-status');
const proxy             = require('fastify-http-proxy');

const pkgDir = require('pkg-dir');
const path     = require('path');
const os       = require('os');
const hyperid  = require('hyperid');
const uuid     = hyperid();
const CryptoJS = require("crypto-js");
const redis    = require("redis");

const started = new Date().toISOString(); 

const { configure }                  = require('./configurations');
const { generators, custom, Issuer, TokenSet } = require('openid-client');


const config : Configurable = configure();
const redisClient = redis.createClient(config.redisConnection);


custom.setHttpOptionsDefaults({
    timeout: config.proxy.httpTimeout || 100000,
});


redisClient.on("error", function(error : any) {
    console.error(error);
});

redisClient.on("ready", function(){
    console.log(`Connected to Redis: ${config.redisConnection}`)
})

const callbackWithHost = `${config.host}/${config.auth.redirect_endpoint}`

Issuer.discover(config.auth.openidc_discovery_uri)
.then((openIDResponse : any) => {

    const server  = fastify({
        logger: true
    });

    const client = new openIDResponse.Client({
        client_id: config.auth.client_id,
        client_secret: config.auth.client_secret,
        redirect_uris: [callbackWithHost],
        response_types: ['code'],
    })

        // Register Fastify-Healthcheck plugin
    server.register(fastifyHealtCheck);

    server.get("/status", (request : FastifyRequest, reply : FastifyReply) => {

        const rootDir = pkgDir.sync();
        const { uptime } = process
        const { name = '', version = '' } = require(path.join(rootDir, 'package.json'));

        const host    = os.hostname();
        
        reply.status(200).send({
            app: name,
            version, 
            startTime: started,
            uptime: uptime(),
            host
        })

    })

    server.register(fastifyCookie, {
        secret: config.cookie.secret,
        parseOptions: config.cookie.parseOptions || {}
    })

    server.register((instance : any, opts : any, next : () => {}) => {
        instance.get("/login", async function(request : FastifyRequest, reply: FastifyReply) {
            const code_verifier = generators.codeVerifier();

            // store the code_verifier in your framework's session mechanism, if it is a cookie based solution
            // it should be httpOnly (not readable by javascript) and encrypted.
            redisClient.set("code_verifier", code_verifier, async (err : RedisError, res : any) => { 
                console.log({code_verifier, res})
                if (!err){
                    const code_challenge = generators.codeChallenge(code_verifier);
                    
                    const authorizationURL = await client.authorizationUrl({
                        scope: 'openid profile offline_access',
                        code_challenge,
                        code_challenge_method: 'S256',
                    });
                    
                    console.log(`Authorization code request was sent to the Authorization Server. URL: ${authorizationURL}`)
            
                    reply.redirect(authorizationURL)
                }else {
                    console.log({err})
                    reply.status(500).send({
                        error: "Code verifier could not be stored in database"
                    })
                }
            })
        })
    
        instance.get("/callback", async (request : FastifyRequest, reply: any) => {
            const params = client.callbackParams(request);
            
            redisClient.get("code_verifier", (err : RedisError, res : any) => {
                if(!err){
                    console.log({res})
                    client.callback(callbackWithHost, params, { code_verifier: res }) // => Promise
                    .then(function (tokenSet : any) {``
                        console.log({tokenSet})
                        const encryptpedObject = CryptoJS.AES.encrypt(JSON.stringify(tokenSet), "1234")
            
                        console.log({encryptpedObject: encryptpedObject.toString()})
                        reply.setCookie('token', encryptpedObject.toString(), 
                        {
                            domain: config.cookie.domain,
                            path: config.cookie.path,
                            sameSite: true,
                            httpOnly: true,
                            signed: true
                        })
                    
                        reply.redirect("/");
                    }).catch((e : any) => console.error("Error occurred in callback", {e}))
                }
            })
        });

        next()
    })

    server.register((instance : any, opts : any, next : () => {}) => {
        instance.addHook('onRequest', (request : any, reply : FastifyReply, done : () => {}) => {
            const { cookies: { token } } = request;
                
            if(token != undefined && token != '' && token != null) {
                const parsedTokenSet = new TokenSet(JSON.parse(CryptoJS.AES.decrypt(token, "1234")))
                console.log({parsedTokenSet})
                done()
            }else {
                reply.status(401).send({
                    error: "Unauthorized request"
                })
            }
            
    
        })
        instance.register(proxy, {
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

        next()
    })

    console.log(`Listening on PORT: ${process.env.PORT}`)
    server.listen(process.env.PORT)
})
.catch((e : any) => console.error("Error occurred while trying to discover the Open ID Connect Configurations", {e}))


