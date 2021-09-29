import { Configurable } from './types'
import configLoader from 'config'

const pkg = require('../package.json')

export function getEnvironment (): string {
  return configLoader.util.getEnv('NODE_ENV')
}

export function getConfiguration (): Configurable {
  const config: Configurable = configLoader.util.toObject()

  configLoader.get('auth')
  configLoader.get('proxy')
  configLoader.get('cookie')
  configLoader.get('baseUrl')

  if (!config.redisConnection) {
    console.log('Redis connection not configured, using local.')
    config.redisConnection = 'redis://127.0.0.1:6379'
  }

  if (!config.cookie.tokenCookieName) {
    config.cookie.tokenCookieName = 'token'
  }

  // Remove leading / if it exists
  if (config.auth.redirectUrl && config.auth.redirectUrl.startsWith('/')) {
    config.auth.redirectUrl = config.auth.redirectUrl.substr(1)
  }

  if (config.sentry) {
    if (!config.sentry.environment) { config.sentry.environment = getEnvironment() }

    config.sentry.release = `${pkg.name}@${pkg.version}`
  }

  if (!config.port) { config.port = 3002 }

  return config
}
