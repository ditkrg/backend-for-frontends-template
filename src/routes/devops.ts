import { FastifyRequest, FastifyReply } from 'fastify'
import { Configurable } from '../types'
import { name, version } from '../../package.json'
import os from 'os'
import * as Sentry from '@sentry/node'

export default (opts: { server: any, bootStartTime: any, config: Configurable }) => {
  const { server, bootStartTime, config } = opts

  // Only initialize sentry if we have it configured and not in development.
  if (process.env.NODE_ENV !== 'development') {
    if (config.sentry) {
      Sentry.init(config.sentry)

      server.addHook(
        'onError',
        (request: any, reply: any, error: unknown, done: any) => {
          // Only send Sentry errors when not in development

          Sentry.captureException(error)
          done()
        }
      )
      console.log('Configuring sentry')
    } else console.log('[WARN] Sentry not configured')
  } else console.log('[INFO] Skipping sentry in development')

  server.get('/status', (request: FastifyRequest, reply: FastifyReply) =>
    reply.status(200).send({
      app: name,
      version,
      startTime: bootStartTime,
      uptime: process.uptime(),
      host: os.hostname()
    }))
}
