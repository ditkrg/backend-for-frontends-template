import { Configurable } from "./types";

const config = require(process.env.CONFIGURATIONS_FILE_PATH || "./config.json")

exports.configure = () : Configurable =>  {
    return {
        ...config,
        host: `${config.app.useSSL ? 'https' : 'http'}://${config.app.domain}:${process.env.PORT}`
    };
}