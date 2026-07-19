import type { DB } from './db/generated-types.js'
import type { Kysely } from 'kysely'

import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'

import { getDatabase, initDatabase } from './db/connection.js'
import { NotFoundError } from './errors/index.js'
import { setupErrorHandler } from './middleware/error-handler.js'
import { setupOpenAPIDoc, setupSwaggerUI } from './middleware/openapi-config.js'
import { setupRequestContext } from './middleware/request-context.js'
import { createValidationHook } from './middleware/validation-hook.js'
import { registerApiRoutes } from './routes/index.js'

export function buildApp(database?: Kysely<DB>): OpenAPIHono {
  const app = new OpenAPIHono({ defaultHook: createValidationHook() })

  app.use('*', cors({
    origin: (origin) => origin === (process.env.FRONTEND_URL ?? 'http://localhost:5173') ? origin : '',
    credentials: true,
    allowHeaders: ['Content-Type', 'X-Request-ID', 'X-Trace-ID'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'X-Request-ID', 'X-Trace-ID'],
    maxAge: 600,
  }))

  setupRequestContext(app)
  registerApiRoutes(app, database)
  setupOpenAPIDoc(app)
  setupSwaggerUI(app)
  setupErrorHandler(app)
  app.notFound(() => { throw new NotFoundError('Resource not found') })

  return app
}

export function initializeApp(): OpenAPIHono {
  initDatabase()
  return buildApp(getDatabase())
}
