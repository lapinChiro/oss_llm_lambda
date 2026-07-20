import type { Logger } from '@app/utils'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Context } from 'hono'

import { createLogger } from '../utils/logger.js'

const logger = createLogger({ service: 'backend' })

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function getLogger(c: Context): Logger { return c.get('logger') ?? logger }

export function requestLogFields(req: { method: string; path: string }): { method: string; path: string } {
  return { method: req.method, path: req.path }
}

export function setupRequestContext(app: OpenAPIHono): void {
  app.use('*', async (c, next) => {
    const requestId = c.req.header('X-Request-ID') ?? generateRequestId()
    const traceId = c.req.header('X-Trace-ID') ?? crypto.randomUUID()
    const requestLogger = logger.child({ traceId })
    c.set('requestId', requestId)
    c.set('traceId', traceId)
    c.set('logger', requestLogger)
    c.header('X-Request-ID', requestId)
    c.header('X-Trace-ID', traceId)
    await next()
    requestLogger.info('request completed', { ...requestLogFields(c.req), status: c.res.status })
  })
}
