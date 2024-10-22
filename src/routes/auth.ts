import { FastifyRequest, FastifyReply } from 'fastify'
import { IncomingMessage } from 'node:http'
import { generators, Client, TokenSet, Issuer, ClientMetadata } from 'openid-client'
import { Configurable } from '../types'
import { redisClient } from '../index'
import hyperid from 'hyperid'
import TokensManager from '../tokens-manager'
const uuid = hyperid()

export default (opts: { server: any, config: Configurable, openIDResponse: Issuer<Client>, client: Client }) => {
  const { server, config, openIDResponse, client } = opts
  const clientConfig : ClientMetadata = {
    client_id: config.auth.clientId,
    client_secret: config.auth.clientSecret
  }

  const baseUrlIsDefined = config.baseUrl && config.baseUrl.length > 0

  server.get(
    '/auth/login',
    async function (request: FastifyRequest, reply: FastifyReply) {
      // Pluck cookies, hostname, protocol, and cookie for later use.
      const {
        cookies: { [config.cookie.tokenCookieName]: token },
        hostname,
        protocol
      } = request

      const redirectUris = baseUrlIsDefined ? [`${config.baseUrl}/${config.auth.redirectUrl}`] : [`${protocol}://${hostname}/${config.auth.redirectUrl}`]

      // Sets up the client with redirect_uri being the current host name
      const client: Client = new openIDResponse.Client({
        ...clientConfig,
        response_types: ['code'],
        redirect_uris: redirectUris
      })

      try {
        if (!token) { throw Error('401') }

        const unsignedCookie: { valid: boolean, renew: boolean, value: string } = reply.unsignCookie(token) as any

        const tokenManager = new TokensManager(
          client,
          redisClient,
          config
        )
        if (!unsignedCookie.valid) { throw Error('401') }

        await tokenManager.validateToken(unsignedCookie.value)
        if (tokenManager.refreshedTokenExpired) {
          await redisClient.del(unsignedCookie.value)
          throw Error('401')
        }
        reply.redirect('/')
        return
      } catch (e: any) {
        if (e.message === '401') {
          reply.clearCookie(config.cookie.tokenCookieName, {
            domain: config.cookie.domain,
            path: config.cookie.path,
            sameSite: true,
            httpOnly: true,
            signed: true,
            secure: true
          })

          const codeVerifier = generators.codeVerifier()
          const codeVerifierKey = uuid()
          // store the codeVerifier in your framework's session mechanism, if it is a cookie based solution
          // it should be httpOnly (not readable by javascript) and encrypted.

          try {
            await redisClient.set(
              codeVerifierKey,
              codeVerifier,
              { EX: 60 * 60 * 24 }
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
    async (request: IncomingMessage, reply: FastifyReply) => {
      const { hostname, protocol } = request as any

      const params = client.callbackParams(request)

      const { state } = params

      const redirectUrl = baseUrlIsDefined ? `${config.baseUrl}/${config.auth.redirectUrl}` : `${protocol}://${hostname}/${config.auth.redirectUrl}`

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

            await redisClient.set(identifier, JSON.stringify(tokenSet), {
              EX: 60 * 60 * 24 * (config.cookie.expiryInDays || 30)
            })
            await redisClient.del(state)

            const today = new Date()
            const daysFromNow = new Date(today).setDate(today.getDate() + (config.cookie?.expiryInDays || 30))

            reply
              .setCookie(config.cookie.tokenCookieName, identifier, {
                domain: config.cookie.domain,
                path: config.cookie.path,
                expires: new Date(daysFromNow),
                sameSite: true,
                httpOnly: true,
                signed: true,
                secure: true
              })
              .redirect('/')
          } catch (error: any) {
            reply.status(500).send({
              error: 'Failed to store cookie'
            })
          }
        } catch (error: any) {
          console.error('Error occurred in callback', error)
          console.log({ error })
          if (error.name === 'OPError') {
            reply.redirect(`/?error=${error.error}`)
            return
          }

          reply.redirect('/?error=unknown')
        }
      } catch (error: unknown) {
        reply.status(500).send({
          error: 'Failed to store refresh token'
        })
      }
    }
  )
}
