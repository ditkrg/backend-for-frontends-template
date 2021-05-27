import { Configurable } from "./types";
import configLoader from 'config';

const pkg = require("../package.json");

export function getEnvironment(): string {
    return configLoader.util.getEnv('NODE_ENV');
}

export function getConfiguration(): Configurable {

    const config: Configurable = configLoader.util.toObject();

    configLoader.get('proxy');
    configLoader.get('cookie');
    configLoader.get('auth');
    configLoader.get('app');
    configLoader.get('storeConfig');

    if (!config.host)
        config.host = `${config.app.useSSL ? 'https' : 'http'}://${config.app.domain}:${process.env.PORT}`

    if (!config.redisConnection)
        config.redisConnection = 'redis://127.0.0.1:6379';

    if (config.sentry) {

        if (!config.sentry.environment)
            config.sentry.environment = getEnvironment();

        config.sentry.release = `${pkg.name}@${pkg.version}`;
    }

    return config;
}