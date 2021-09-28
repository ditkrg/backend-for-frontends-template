import { FastifyRequest, FastifyReply } from 'fastify'
import { IncomingMessage } from 'node:http'
import { generators, Client, TokenSet } from 'openid-client'
import { Configurable } from '../types'
import hyperid from 'hyperid'
import TokensManager from '../tokens-manager'
const uuid = hyperid()

export default (opts: { server: any, redisClient: any, config: Configurable, client: Client, redirectUrl: string }) => {
  const { server, redisClient, config, client, redirectUrl } = opts
  server.get(
    '/auth/login',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const {
        cookies: { token }
      } = request

      try {
        if (!token) { throw Error('401') }

        const unsignedCookie : { valid: boolean, renew: boolean, value: string } = reply.unsignCookie(token) as any

        const tokenManager = new TokensManager(
          client,
          redisClient
        )
        if (!unsignedCookie.valid) { throw Error('401') }

        await tokenManager.validateToken(unsignedCookie.value)
        if (tokenManager.refreshedTokenExpired) {
          redisClient.del(unsignedCookie.value)
          throw Error('401')
        }
        reply.redirect('/')
        return
      } catch (e: any) {
        if (e.message === '401') {
          reply.clearCookie('token')

          const codeVerifier = generators.codeVerifier()
          const codeVerifierKey = uuid()
          // store the codeVerifier in your framework's session mechanism, if it is a cookie based solution
          // it should be httpOnly (not readable by javascript) and encrypted.

          try {
            await redisClient.set(
              codeVerifierKey,
              codeVerifier
            )

            const codeChallenge = generators.codeChallenge(codeVerifier)

            let scopes = 'openid profile offline_access'

            if (config.auth.scopes?.length) {
              if (typeof config.auth.scopes === 'string') { scopes += ` ${config.auth.scopes}` } else { scopes += ` ${config.auth.scopes.join(' ')}` }
            }

            const authorizationURL = client.authorizationUrl({
              scope: scopes,
              code_challenge: codeChallenge,
              code_challenge_method: 'S256',
              state: codeVerifierKey
            })

            reply.redirect(authorizationURL)
          } catch (error) {
            console.log({ error })
            reply.status(500).send({
              error: 'Code verifier could not be stored in database'
            })
          }
        }
      }
    }
  )

  server.get(
    '/auth/callback',
    async (request: IncomingMessage, reply: any) => {
      const params = client.callbackParams(request)

      const { state } = params

      if (!state) {
        reply.status(400).send({
          error: 'Compromised authorization code'
        })
        return
      }

      try {
        const getCodeVerifierFromDB: Promise<string> | any = await redisClient.get(state)

        try {
          const tokenSet: TokenSet = await client.callback(redirectUrl, params, { code_verifier: await getCodeVerifierFromDB, state })

          try {
            const identifier = uuid()
            await redisClient.set(identifier, JSON.stringify(tokenSet))

            redisClient.del(state)

            reply
              .setCookie('token', identifier, {
                domain: config.cookie.domain,
                path: config.cookie.path,
                sameSite: true,
                httpOnly: true,
                signed: true
              })
              .redirect('/')
          } catch (error: any) {
            reply.status(500).send({
              error: 'Failed to store cookie'
            })
          }
        } catch (error: any) {
          console.error('Error occurred in callback', { error })
        }
      } catch (error: unknown) {
        reply.status(500).send({
          error: 'Failed to store refresh token'
        })
      }
    }
  )
}
