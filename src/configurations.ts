import { Configurable } from "./types";

const config = require(process.env.CONFIGURATIONS_FILE_PATH || "./config.json")

exports.configure = () : Configurable =>  {
    return {
        ...config,
        host: `${config.app.useSSL ? 'https' : 'http'}://${config.app.domain}:${process.env.PORT}`,
        redisConnection: process.env.REDIS_URL || "redis://127.0.0.1:6379"
    };
}