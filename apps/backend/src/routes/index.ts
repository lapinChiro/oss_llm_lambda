import type { DB } from '../db/generated-types.js'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Kysely } from 'kysely'

import { createRoute, z } from '@hono/zod-openapi'

import { registerTodoRoutes } from './todos.js'

const healthRoute = createRoute({
  method: 'get',
  path: '/api/health',
  tags: ['System'],
  operationId: 'health',
  responses: {
    200: {
      description: 'Service health',
      content: { 'application/json': { schema: z.object({ status: z.literal('ok') }) } },
    },
  },
})

export function registerApiRoutes(app: OpenAPIHono, database?: Kysely<DB>): void {
  app.openapi(healthRoute, (c) => c.json({ status: 'ok' }, 200))
  if (database) registerTodoRoutes(app, database)
}
