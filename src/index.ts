import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { RedisClient } from "redis";
import { Configurable } from "./types";

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const fastify           = require('fastify');
const fastifyCookie     = require('fastify-cookie');
const fastifyHealtCheck = require('fastify-healthcheck');
const proxy             = require('fastify-http-proxy');

const pkgDir   = require('pkg-dir');
const path     = require('path');
const os       = require('os');
const hyperid  = require('hyperid');
const uuid     = hyperid();
const redis    = require("redis");

const started  = new Date().toISOString(); 

const { configure }                  = require('./configurations');
import { generators, custom, Issuer, TokenSet, Client } from "openid-client";
const { encrypt, decrypt } = require("./encryption")

const config : Configurable = configure();
const redisClient : RedisClient = redis.createClient(config.redisConnection);


custom.setHttpOptionsDefaults({
    timeout: config.proxy.httpTimeout || 100000,
});


redisClient.on("error", function(error : any) {
    console.error(error);
    process.exit();
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

    const client : Client = new openIDResponse.Client({
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
            redisClient.set("code_verifier", code_verifier, async (err : unknown, res : any) => { 
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
    
        instance.get("/callback", async (request : IncomingMessage, reply: any) => {
            const params = client.callbackParams(request);
            
            redisClient.get("code_verifier", (err : unknown, res : any) => {
                if(!err){
                    console.log({res})
                    client.callback(callbackWithHost, params, { code_verifier: res }) // => Promise
                    .then(function (tokenSet : any) {
                        const { refresh_token } = tokenSet;
                        const encrypted = encrypt(refresh_token, "1234")
                        

                        redisClient.set(refresh_token, JSON.stringify(tokenSet), (err : unknown, res: any) => {
                            if(!err){
                                reply.setCookie('token', encrypted, 
                                {
                                    domain: config.cookie.domain,
                                    path: config.cookie.path,
                                    sameSite: true,
                                    httpOnly: true
                                }).redirect("/")                            
                            }else {
                                reply.status(500).send({
                                    error: "Failed to store refresh token in database"
                                })
                            }
                        })
                    }).catch((e : any) => console.error("Error occurred in callback", {e}))
                }
            })
        });

        next()
    })

    server.register((instance : any, opts : any, next : () => {}) => {
        // instance.addHook('preSerialization', (request : any, reply : FastifyReply, done : any) => {
            
    
        // })
        instance.register(proxy, {
            upstream: config.proxy.upstream,
            prefix: config.proxy.prefix || "",
            http2: config.proxy.enableHTTP2 || false,
            preHandler: (request : any, reply : FastifyReply, done : any) => {
                const { cookies: { token } } = request;
                
                if(token != undefined && token != '' && token != null) {

                    const decrypted = decrypt(token, "1234")
                    redisClient.get(decrypted, async (err: unknown, res : any) => {

                        if(err){
                            // Desirably, report this to Sentry
                            reply.status(500).send({
                                error: "Failed to associate cookie with any records. This could be a possible cookie hijacking attack!"
                            })
                            return;
                        }
                        const tokenSet  = new TokenSet(JSON.parse(res))
                        let accessToken = tokenSet.access_token;

                        if(tokenSet.expired()){
                            try {
                                const newTokenSet = await client.refresh(tokenSet)
                                accessToken = await newTokenSet.access_token
                                redisClient.del(decrypted, (deleteErr : unknown, innerRes) => {
                                    if(deleteErr){
                                        reply.status(500).send({
                                            error: "Failed to delete old records and update it with a new token"
                                        })
                                        return
                                    }

                                    redisClient.set(newTokenSet.refresh_token as string, JSON.stringify(newTokenSet), (setError : unknown, mostInnerResponse) => {
                                        
                                        if(setError){
                                            // Desirably, report this to Sentry
                                            reply.status(500).send({
                                                error: "Deleted the old token but failed to register the most recent one."
                                            })
                                            return;
                                        }
                                    })
                                })
                            }catch(err : unknown){
                                reply.redirect("/login")
                                return;
                            }
                        }
                        
                        return { ...request, headers: {...request.headers, 'Authorization': `Bearer ${accessToken}`}}
                })
                }else {
                    reply.status(401).send({
                        error: "Unauthorized request"
                    })
                }
                
                done()
            },
            replyOptions: {
                rewriteRequestHeaders: (originalReq : IncomingHttpHeaders, headers : any) => {
                    console.log({
                        originalReq,
                        headers
                    })
                }
            }
        })

        next()
    })

    console.log(`Listening on PORT: ${process.env.PORT}`)
    server.listen(process.env.PORT)
})
.catch((e : any) => console.error("Error occurred while trying to discover the Open ID Connect Configurations", {e}))