/* eslint-disable */
import { FastifyReply, FastifyRequest } from "fastify";
import { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { getConfiguration, getEnvironment } from "./configurations";

import * as Sentry from "@sentry/node";

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const fastify = require("fastify");
const fastifyCookie = require("fastify-cookie");
const fastifyHealtCheck = require("fastify-healthcheck");
const proxy = require("fastify-http-proxy");

const pkgDir = require("pkg-dir");
const path = require("path");
const os = require("os");
const hyperid = require("hyperid");
const uuid = hyperid();
const started = new Date().toISOString();
const config = getConfiguration();

const { encrypt } = require("./encryption");

// const config: Configurable = configure();

import { createNodeRedisClient } from 'handy-redis';

if (!config.redisConnection)
  throw new Error('Redis is not configured')

const redisClient = createNodeRedisClient(config.redisConnection);

import { generators, custom, Issuer, TokenSet, Client } from "openid-client";
import TokensManager from "./tokens-manager";
import { TokenResponse } from "./types";

// Only initialize sentry if we have it configured.
if (config.sentry)
  Sentry.init(config.sentry);

custom.setHttpOptionsDefaults({
  timeout: config.proxy.httpTimeout || 100000,
});

redisClient.nodeRedis.on("error", function (error: any) {
  console.error(error);
  process.exit();
});

redisClient.nodeRedis.on("ready", function () {
  console.log(`Connected to Redis: ${config.redisConnection}`);
});

const callbackWithHost = `${config.host}/${config.auth.redirect_endpoint}`;

Issuer.discover(config.auth.openidc_discovery_uri)
  .then((openIDResponse: any) => {
    const server = fastify({
      logger: true,
    });

    const client: Client = new openIDResponse.Client({
      client_id: config.auth.client_id,
      client_secret: config.auth.client_secret,
      redirect_uris: [callbackWithHost],
      response_types: ["code"],
    });

    // Register Fastify-Healthcheck plugin
    server.register(fastifyHealtCheck);

    server.addHook(
      "onError",
      (request: any, reply: any, error: unknown, done: any) => {
        // Only send Sentry errors when not in development
        if (process.env.NODE_ENV == "development") {
          Sentry.captureException(error);
        }
        done();
      }
    );

    server.get("/status", (request: FastifyRequest, reply: FastifyReply) => {
      const rootDir = pkgDir.sync();
      const { uptime } = process;
      const { name = "", version = "" } = require(path.join(
        rootDir,
        "package.json"
      ));

      const host = os.hostname();

      reply.status(200).send({
        app: name,
        version,
        startTime: started,
        uptime: uptime(),
        host,
      });
    });

    server.register(fastifyCookie, {
      secret: config.cookie.secret,
      parseOptions: config.cookie.parseOptions || {},
    });

    server.register((instance: any, opts: any, next: () => {}) => {
      instance.get(
        "/login",
        async function (request: FastifyRequest, reply: FastifyReply) {
          const code_verifier = generators.codeVerifier();

          // store the code_verifier in your framework's session mechanism, if it is a cookie based solution
          // it should be httpOnly (not readable by javascript) and encrypted.
          redisClient.set(
            config.storeConfig.codeVerifierKeyName,
            code_verifier
          )
            .then(async _response => {
              const code_challenge = generators.codeChallenge(code_verifier);

              let scopes = "openid profile offline_access";


              if (config.auth.scopes?.length) {
                if (typeof config.auth.scopes === 'string')
                  scopes += ` ${config.auth.scopes}`;
                else
                  scopes += ` ${config.auth.scopes.join(" ")}`;
              }

              console.log({ scopes })
              const authorizationURL = await client.authorizationUrl({
                scope: scopes,
                code_challenge,
                code_challenge_method: "S256",
              });

              reply.redirect(authorizationURL);
            })
            .catch(error => {
              console.log({ error })
              reply.status(500).send({
                error: "Code verifier could not be stored in database",
              });
            })

        }
      );

      instance.get(
        "/callback",
        async (request: IncomingMessage, reply: any) => {
          const params = client.callbackParams(request);

          try {
            const getCodeVerifierFromDB: Promise<string> | any = await redisClient.get(config.storeConfig.codeVerifierKeyName);

            client
              .callback(callbackWithHost, params, { code_verifier: await getCodeVerifierFromDB }) // => Promise
              .then(async function (tokenSet: any) {
                const { refresh_token } = tokenSet;
                const identifier = uuid();
                const encrypted = encrypt(
                  identifier,
                  config.cookie.encryptionSecret
                );
                redisClient.set(identifier, JSON.stringify(tokenSet))
                  .then(_response => {
                    reply
                      .setCookie("token", encrypted, {
                        domain: config.cookie.domain,
                        path: config.cookie.path,
                        sameSite: true,
                        httpOnly: true,
                      })
                      .redirect("/");
                  }).catch(err => reply.status(500).send({
                    error: "Failed to store refresh token in database",
                  }))
              })
              .catch((e: any) =>
                console.error("Error occurred in callback", { e })
              );

          } catch (error: unknown) {
            reply.status(500).send({
              error: "Failed to store refresh token in database",
            });
          }
        }
      );

      next();
    });

    server.register((instance: any, opts: any, next: () => {}) => {
      instance.addHook("onRequest", (request: any, reply: any, done: any) => {
        const {
          cookies: { token },
        } = request;

        const tokenManager = new TokensManager(
          client,
          redisClient,
          config
        );

        tokenManager
          .validateToken(token)
          .then((res: any) => {

            request.headers[
              "Authorization"
            ] = `Bearer ${res.tokenSet?.access_token}`;

            done();
          })
          .catch((error) => {
            console.log({ error });

            if (error.message == "401") {
              reply.clear
              reply.status(401).send({
                error: "Unauthorized Request",
              });
            } else {
              done(error);
            }
          });
      });

      instance.register(proxy, {
        upstream: config.proxy.upstream,
        prefix: config.proxy.prefix || "",
        http2: config.proxy.enableHTTP2 || false,
        replyOptions: {
          rewriteRequestHeaders: (
            originalReq: IncomingHttpHeaders,
            headers: any
          ) => ({
            ...headers,
            "request-id": uuid(),
          }),
        },
      });

      next();
    });

    console.log(`Listening on PORT: ${process.env.PORT}`);
    server.listen(process.env.PORT ?? 3002, "0.0.0.0");
  })
  .catch((e: any) =>
    console.error(
      "Error occurred while trying to discover the Open ID Connect Configurations",
      { e }
    )
  );
