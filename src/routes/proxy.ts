import { IncomingMessage } from 'http'
import TokensManager from '../tokens-manager'

import proxy from 'fastify-http-proxy'

import { Configurable } from './../types'
import { FastifyReply } from 'fastify'

export default (opts: { server: any, client: any, redisClient: any, config: Configurable }) => {
  const { server, client, redisClient, config } = opts
  server.register((instance: any, opts: any, next: () => {}) => {
    instance.addHook('onRequest', async (request: any, reply: FastifyReply, done: any) => {
      const {
        cookies: { [config.cookie.tokenCookieName]: token },
      } = request

      const tokenManager = new TokensManager(
        client,
        redisClient
      )

      try {
        if (!token) {
          throw Error('401')
        }

        const unsignedCookie : { valid: boolean, renew: boolean, value: string } = reply.unsignCookie(token) as any

        if (!unsignedCookie.valid) {
          throw Error('401')
        }
        const validatedToken = await tokenManager.validateToken(unsignedCookie.value)
        request.headers.Authorization = `Bearer ${validatedToken.tokenSet?.access_token}`

      } catch (error : any) {
        if (error.message === '401') {
          reply.clearCookie(config.cookie.tokenCookieName)
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
          const bearerToken : string = request.headers.Authorization as string

          const userInfo = await client.userinfo(bearerToken.split(' ')[1])

          reply.send(userInfo)
        } catch (error: unknown) {
          reply.status(500).send({
            error: 'Unknown error occurred'
          })
        }
      }
    )

    instance.get(
      '/auth/logout',
      async function (request: any, reply: any) {
        const {
          cookies: { token }
        } = request

        const unsignedCookie : { valid: boolean, renew: boolean, value: string } = reply.unsignCookie(token) as any

        const tokenManager = new TokensManager(
          client,
          redisClient
        )

        try {
          await tokenManager.logOut(unsignedCookie?.value)
          reply.clearCookie(config.cookie.tokenCookieName)
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