import { IncomingMessage } from 'http'
import TokensManager from '../tokens-manager'

import proxy from '@fastify/http-proxy'

import { FastifyReply } from 'fastify'
import { Configurable } from './../types'
import { redisClient } from '../index'
import { Client } from 'openid-client'

export default (opts: { server: any, config: Configurable, client: Client }) => {
  const { server, config, client } = opts

  server.register((instance: any, opts: any, next: () => {}) => {
    instance.addHook('onRequest', async (request: any, reply: FastifyReply, done: any) => {
      const {
        cookies: { [config.cookie.tokenCookieName]: token }
      } = request

      const tokenManager = new TokensManager(
        client,
        redisClient,
        config
      )

      try {
        if (!token) {
          throw Error('401')
        }

        const unsignedCookie: { valid: boolean, renew: boolean, value: string } = reply.unsignCookie(token) as any

        if (!unsignedCookie.valid) {
          console.log("Throws 401 because unsignedCookie.valid is false")
          throw Error('401')
        }
        const validatedToken = await tokenManager.validateToken(unsignedCookie.value)

        const accessToken = validatedToken.tokenSet?.access_token
        request.headers.Authorization = `Bearer ${accessToken}`

      } catch (error: any) {
        if (error.message === '401') {
          console.log("Throws 401 because token validation has failed", { error })

          reply.clearCookie(config.cookie.tokenCookieName, {
            domain: config.cookie.domain,
            path: config.cookie.path,
            sameSite: true,
            httpOnly: true,
            signed: true,
            secure: true
          })
          reply.status(401).send({
            error: 'Unauthorized Request'
          })
        } else {
          done(error)
        }
      }
    })

    instance.get(
      '/auth/userinfo',
      async (request: IncomingMessage, reply: any) => {
        try {
          const bearerToken: string = request.headers.Authorization as string

          const userInfo = await client.userinfo(bearerToken.split(' ')[1])

          reply.send(userInfo)
        } catch (error: unknown) {
          reply.status(500).send({
            error: 'Unknown error occurred',
            details: error
          })
        }
      }
    )

    instance.get(
      '/auth/logout',
      async function (request: any, reply: FastifyReply) {
        const {
          cookies: { [config.cookie.tokenCookieName]: token }
        } = request

        const unsignedCookie: { valid: boolean, renew: boolean, value: string } = reply.unsignCookie(token) as any

        const tokenManager = new TokensManager(
          client,
          redisClient,
          config
        )

        try {
          await tokenManager.logOut(unsignedCookie?.value)
          reply.clearCookie(config.cookie.tokenCookieName, {
            domain: config.cookie.domain,
            path: config.cookie.path,
            sameSite: true,
            httpOnly: true,
            signed: true,
            secure: true
          })
          reply.redirect('/')
        } catch (e) {
          console.log({ e })
          reply.status(500).send({
            error: 'Unknown error occurred'
          })
        }
      }
    )

    instance.register(proxy, {
      upstream: config.proxy.upstream,
      prefix: config.proxy.prefix || '',
      http2: config.proxy.enableHTTP2 || false
    })

    next()
  })
}
