import { Configurable } from "./types";

const config = require(process.env.CONFIGURATIONS_FILE_PATH || "./config.temp.json")

exports.configure = () : Configurable =>  {
    return config;
}