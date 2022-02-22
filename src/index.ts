import { getConfiguration } from './configurations'
import { Configurable } from './types'

import devOpsRoutes from './routes/devops'
import authRoutes from './routes/auth'
import proxyRoutes from './routes/proxy'

import fastify from 'fastify'
import fastifyCookie, { FastifyCookieOptions } from 'fastify-cookie'
import fastifyHealtCheck from 'fastify-healthcheck'

import { createClient } from 'redis'
import { Client, custom, Issuer } from 'openid-client'

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const bootStartTime = new Date().toISOString()
const config: Configurable = getConfiguration()

if (!config.redisConnection) { throw new Error('Redis is not configured') }

export const redisClient = createClient({ url: config.redisConnection })

custom.setHttpOptionsDefaults({
  timeout: config.proxy.httpTimeout || 100000
})

redisClient.on('error', function (error: any) {
  console.error(error)
  process.exit()
});

(async () => {
  await redisClient.connect()

  console.log('Redis connected and ready')

  const redirectUrl = `${config.baseUrl}/${config.auth.redirectUrl}`

  console.log(`OpenID Redirect Url: ${redirectUrl}`)
  console.log(`OpenID Discovery Url: ${config.auth.discoveryDocumentUrl}`)

  try {
    const openIDResponse: Issuer<Client> = await Issuer.discover(config.auth.discoveryDocumentUrl)

    const client: Client = new openIDResponse.Client({
      client_id: config.auth.clientId,
      client_secret: config.auth.clientSecret
    })

    const server = fastify({
      logger: config.enableFastifyLogging
    })

    // Register Fastify-Healthcheck plugin
    server.register(fastifyHealtCheck)

    server.register(fastifyCookie, {
      secret: config.cookie.secret,
      parseOptions: config.cookie.parseOptions || {}
    } as FastifyCookieOptions)

    devOpsRoutes({ server, bootStartTime, config })
    authRoutes({ server, config, openIDResponse, client })
    proxyRoutes({ server, config, client })

    const port = config.port ?? 3002
    console.log(`Listening on PORT: ${port}`)
    server.listen(port, '0.0.0.0')
  } catch (e) {
    console.error(
      'Error occurred while trying to discover the Open ID Connect Configurations',
      { e }
    )
    process.exit(2)
  }
})()
