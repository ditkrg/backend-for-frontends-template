import { Configurable } from './types'
import configLoader from 'config'
import { name as appName, version as appVersion } from '../package.json'

export function getEnvironment (): string {
  return configLoader.util.getEnv('NODE_ENV')
}

export function getConfiguration (): Configurable {
  const config: Configurable = configLoader.util.toObject()

  configLoader.get('auth')
  configLoader.get('proxy')
  configLoader.get('cookie')

  if (!config.redisConnection) {
    console.log('Redis connection not configured, using local.')
    config.redisConnection = 'redis://127.0.0.1:6379'
  }

  // Remove leading / if it exists
  if (config.auth.redirectUrl && config.auth.redirectUrl.startsWith('/')) {
    config.auth.redirectUrl = config.auth.redirectUrl.substr(1)
  }

  if (config.sentry) {
    if (!config.sentry.environment) { config.sentry.environment = getEnvironment() }

    config.sentry.release = `${appName}@${appVersion}`
  }

  if (!config.port) { config.port = 3002 }

  return config
}
