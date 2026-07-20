import type { DB } from '../db/generated-types.js'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Kysely } from 'kysely'

import { TodoRepository } from '../repositories/todo.repository.js'
import { CreateTodoSchema, TodoParamsSchema, TodoSchema, UpdateTodoSchema } from '../schemas/todos.js'
import { TodoService } from '../services/todo.service.js'
import { createCrudHandlers } from '../utils/crud-handlers.js'

import { registerCrudRoutes } from './crud-routes.js'

export function registerTodoRoutes(app: OpenAPIHono, database: Kysely<DB>): void {
  const service = new TodoService(new TodoRepository(database))
  registerCrudRoutes(app, {
    basePath: '/api/todos',
    tag: 'Todos',
    schemas: {
      entity: TodoSchema, create: CreateTodoSchema, update: UpdateTodoSchema, params: TodoParamsSchema,
    },
    handlers: createCrudHandlers(service, {
      generateId: false,
      listOrderBy: [{ column: 'created_at', order: 'desc' }, { column: 'uuid', order: 'desc' }],
    }),
  })
}
