import { FastifyRequest, FastifyReply } from 'fastify'
import { IncomingMessage } from 'node:http'
import { generators, Client, TokenSet } from 'openid-client'
import { encrypt } from '../encryption'
import { Configurable } from '../types'
import hyperid from 'hyperid'
const uuid = hyperid()

export default (opts: { server: any, redisClient: any, config: Configurable, client: Client, redirectUrl: string }) => {
  const { server, redisClient, config, client, redirectUrl } = opts
  server.get(
    '/auth/login',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const codeVerifier = generators.codeVerifier()

      // store the codeVerifier in your framework's session mechanism, if it is a cookie based solution
      // it should be httpOnly (not readable by javascript) and encrypted.

      try {
        await redisClient.set(
          config.storeConfig.codeVerifierKeyName,
          codeVerifier
        )

        const codeChallenge = generators.codeChallenge(codeVerifier)

        let scopes = 'openid profile offline_access'

        if (config.auth.scopes?.length) {
          if (typeof config.auth.scopes === 'string') { scopes += ` ${config.auth.scopes}` } else { scopes += ` ${config.auth.scopes.join(' ')}` }
        }

        const authorizationURL = await client.authorizationUrl({
          scope: scopes,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256'
        })

        reply.redirect(authorizationURL)
      } catch (error) {
        console.log({ error })
        reply.status(500).send({
          error: 'Code verifier could not be stored in database'
        })
      }
    }
  )

  server.get(
    '/auth/callback',
    async (request: IncomingMessage, reply: any) => {
      const params = client.callbackParams(request)

      try {
        const getCodeVerifierFromDB: Promise<string> | any = await redisClient.get(config.storeConfig.codeVerifierKeyName)

        try {
          const tokenSet: TokenSet = await client.callback(redirectUrl, params, { code_verifier: await getCodeVerifierFromDB })

          const identifier = uuid()
          // const encrypted = encrypt(
          //   identifier,
          //   config.cookie.encryptionSecret
          // )

          console.log({ identifier })

          try {
            await redisClient.set(identifier, JSON.stringify(tokenSet))

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
              error: 'Failed to store refresh token in database'
            })
          }
        } catch (error: any) {
          console.error('Error occurred in callback', { error })
        }
      } catch (error: unknown) {
        reply.status(500).send({
          error: 'Failed to store refresh token in database'
        })
      }
    }
  )
}
