import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Handler } from 'hono'

import { createRoute, z } from '@hono/zod-openapi'

import {
  DATABASE_ERROR_DESCRIPTION, errorResponse, NOT_FOUND_DESCRIPTION, successResponse, VALIDATION_ERROR_DESCRIPTION,
} from '../schemas/common.js'

export type CrudOperation = 'getAll' | 'getById' | 'create' | 'update' | 'delete'
type ErrorResponse = ReturnType<typeof errorResponse>
type ExtraResponseMap = Record<number, { description: string }>

export function buildCrudErrorResponses(
  operation: CrudOperation,
  extra: ExtraResponseMap = {},
): Record<number, ErrorResponse> {
  const responses: Record<number, ErrorResponse> = {
    500: errorResponse(DATABASE_ERROR_DESCRIPTION),
  }
  if (operation !== 'getAll') responses[400] = errorResponse(VALIDATION_ERROR_DESCRIPTION)
  if (operation === 'getById' || operation === 'update' || operation === 'delete') {
    responses[404] = errorResponse(NOT_FOUND_DESCRIPTION)
  }
  for (const [status, response] of Object.entries(extra)) {
    responses[Number(status)] = errorResponse(response.description)
  }
  return responses
}

interface CrudRouteOptions {
  basePath: string
  tag: string
  schemas: {
    entity: z.ZodType
    create?: z.ZodType
    update?: z.ZodType
    list?: z.ZodType
    params?: z.ZodObject
    updateResponse?: z.ZodType
  }
  handlers: Partial<Record<CrudOperation, Handler>>
  extraResponses?: Partial<Record<CrudOperation, ExtraResponseMap>>
}

/**
 * Registers the symmetric CRUD surface and its OpenAPI success/error contracts.
 * Authentication is intentionally absent; applications can wrap handlers or add middleware separately.
 */
export function registerCrudRoutes(app: OpenAPIHono, options: CrudRouteOptions): void {
  const { basePath, tag, schemas, handlers } = options
  const params = schemas.params ?? z.object({ uuid: z.uuid() })
  const errors = (operation: CrudOperation): Record<number, ErrorResponse> =>
    buildCrudErrorResponses(operation, options.extraResponses?.[operation])

  if (handlers.getAll) {
    const route = createRoute({
      method: 'get', path: basePath, tags: [tag],
      responses: {
        200: successResponse(schemas.list ?? z.array(schemas.entity), `List of ${tag}`),
        ...errors('getAll'),
      },
    })
    app.openapi(route, handlers.getAll as never)
  }

  if (handlers.getById) {
    const route = createRoute({
      method: 'get', path: `${basePath}/{uuid}`, tags: [tag], request: { params },
      responses: {
        200: successResponse(schemas.entity, `${tag} details`),
        ...errors('getById'),
      },
    })
    app.openapi(route, handlers.getById as never)
  }

  if (handlers.create && schemas.create) {
    const route = createRoute({
      method: 'post', path: basePath, tags: [tag],
      request: { body: { content: { 'application/json': { schema: schemas.create } } } },
      responses: {
        201: successResponse(schemas.entity, `${tag} created`),
        ...errors('create'),
      },
    })
    app.openapi(route, handlers.create as never)
  }

  if (handlers.update && schemas.update) {
    const route = createRoute({
      method: 'put', path: `${basePath}/{uuid}`, tags: [tag], request: {
        params,
        body: { content: { 'application/json': { schema: schemas.update } } },
      },
      responses: {
        200: successResponse(schemas.updateResponse ?? schemas.entity, `${tag} updated`),
        ...errors('update'),
      },
    })
    app.openapi(route, handlers.update as never)
  }

  if (handlers.delete) {
    const route = createRoute({
      method: 'delete', path: `${basePath}/{uuid}`, tags: [tag], request: { params },
      responses: { 204: { description: `${tag} deleted` }, ...errors('delete') },
    })
    app.openapi(route, handlers.delete as never)
  }
}
