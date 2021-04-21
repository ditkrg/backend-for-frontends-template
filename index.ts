import { RequestHeadersDefault } from "fastify";
import { IncomingHttpHeaders } from "node:http";

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const Fastify = require('fastify');
const server  = Fastify();
const proxy   = require('fastify-http-proxy')
const hyperid = require('hyperid')
const uuid = hyperid()

const { configure } = require('./configurations')

configure();

server.register(proxy, {
    upstream: "http://localhost:3001",
    prefix: 'frps',
    http2: false,
    replyOptions: {
        rewriteRequestHeaders: (originalReq : IncomingHttpHeaders, headers : any) => ({
            ...headers, 
            'request-id': uuid()
        })
    }
})

server.listen(3002)