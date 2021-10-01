import { FastifyRequest, FastifyReply } from 'fastify'
import { Configurable } from '../types'
import os from 'os'
import pkgDir from 'pkg-dir'
import path from 'path'
import * as Sentry from '@sentry/node'

export default (opts: { server: any, bootStartTime: any, config: Configurable }) => {
  const { server, bootStartTime, config } = opts

  // Only initialize sentry if we have it configured.
  if (config.sentry) { Sentry.init(config.sentry) }

  server.addHook(
    'onError',
    (request: any, reply: any, error: unknown, done: any) => {
      // Only send Sentry errors when not in development
      if (process.env.NODE_ENV !== 'development') {
        Sentry.captureException(error)
      }
      done()
    }
  )

  server.get('/status', (request: FastifyRequest, reply: FastifyReply) => {
    const rootDir: string = pkgDir.sync() as string
    const { uptime } = process
    const { name = '', version = '' } = require(path.join(
      rootDir,
      'package.json'
    ))

    const host = os.hostname()

    reply.status(200).send({
      app: name,
      version,
      startTime: bootStartTime,
      uptime: uptime(),
      host
    })
  })
}
