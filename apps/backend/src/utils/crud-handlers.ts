import type { Context } from 'hono'

import { randomUUID } from 'node:crypto'

import { NotFoundError } from '../errors/index.js'

export type OrderBy = ReadonlyArray<{ column: string; order: 'asc' | 'desc' }>

export interface CrudRepository<T> {
  findMany(options: { orderBy: OrderBy }): Promise<{ items: T[] }>
  findById(id: string): Promise<T | null>
  create(data: Record<string, unknown>, transaction: unknown): Promise<T>
  update(id: string, data: Record<string, unknown>, transaction: unknown): Promise<T | undefined>
  delete(id: string, transaction: unknown): Promise<void>
  executeInTransaction<R>(callback: (transaction: unknown) => Promise<R>): Promise<R>
}

export interface CrudHandlerOptions<T> {
  generateId?: boolean
  listOrderBy?: OrderBy
  transformForApi?: (entity: T) => Record<string, unknown>
  beforeCreate?: (data: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>
  validateCreate?: (data: Readonly<Record<string, unknown>>) => Promise<void> | void
  validateUpdate?: (context: Context, id: string, data: Readonly<Record<string, unknown>>) => Promise<void> | void
  afterCreate?: (entity: T, data: Readonly<Record<string, unknown>>, transaction: unknown) => Promise<void>
  afterUpdate?: (entity: T, data: Readonly<Record<string, unknown>>, transaction: unknown) => Promise<void>
  afterDelete?: (id: string, transaction: unknown) => Promise<void>
}

export function getValidatedJson(context: Context): Record<string, unknown> {
  return (context.req as { valid(target: 'json'): Record<string, unknown> }).valid('json')
}

function getUuid(context: Context): string {
  const uuid = context.req.param('uuid')
  if (!uuid) throw new Error('Validated uuid path parameter is missing')
  return uuid
}

export function createCrudHandlers<T>(
  repository: CrudRepository<T>,
  options: CrudHandlerOptions<T> = {},
): {
  getAll: (context: Context) => Promise<Response>
  getById: (context: Context) => Promise<Response>
  create: (context: Context) => Promise<Response>
  update: (context: Context) => Promise<Response>
  delete: (context: Context) => Promise<Response>
} {
  const transform = options.transformForApi ?? ((entity: T) => entity as Record<string, unknown>)
  const listOrderBy = options.listOrderBy ?? [{ column: 'created_at', order: 'desc' }]

  return {
    getAll: async (context) => {
      const { items } = await repository.findMany({ orderBy: listOrderBy })
      return context.json({ success: true, data: items.map(transform) }, 200)
    },
    getById: async (context) => {
      const entity = await repository.findById(getUuid(context))
      if (!entity) throw new NotFoundError('Resource not found')
      return context.json({ success: true, data: transform(entity) }, 200)
    },
    create: async (context) => {
      const validated = getValidatedJson(context)
      const base = options.generateId === false ? validated : { ...validated, uuid: randomUUID() }
      await options.validateCreate?.(base)
      const data = await options.beforeCreate?.(base) ?? base
      const entity = await repository.executeInTransaction(async (transaction) => {
        const created = await repository.create(data, transaction)
        await options.afterCreate?.(created, data, transaction)
        return created
      })
      return context.json({ success: true, data: transform(entity) }, 201)
    },
    update: async (context) => {
      const id = getUuid(context)
      const data = getValidatedJson(context)
      await options.validateUpdate?.(context, id, data)
      const entity = await repository.executeInTransaction(async (transaction) => {
        const updated = await repository.update(id, data, transaction)
        if (updated) await options.afterUpdate?.(updated, data, transaction)
        return updated
      })
      if (!entity) throw new NotFoundError('Resource not found')
      return context.json({ success: true, data: transform(entity) }, 200)
    },
    delete: async (context) => {
      const id = getUuid(context)
      await repository.executeInTransaction(async (transaction) => {
        await repository.delete(id, transaction)
        await options.afterDelete?.(id, transaction)
      })
      return context.body(null, 204)
    },
  }
}
