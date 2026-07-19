import type { ApiErrorResponse } from '@app/shared'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import { ERROR_CODE } from '@app/shared'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

import { AppError, convertDatabaseError, InternalServerError } from '../errors/index.js'

import { generateRequestId, getLogger, requestLogFields } from './request-context.js'

type ErrorBase = Pick<ApiErrorResponse, 'success' | 'requestId' | 'timestamp' | 'path'>

export function buildErrorBody(errorBase: ErrorBase, code: string, message: string, details?: unknown): ApiErrorResponse {
  return { ...errorBase, code, message, ...(details === undefined ? {} : { details }) }
}

function base(c: Context): ErrorBase {
  return {
    success: false,
    requestId: c.get('requestId') ?? generateRequestId(),
    timestamp: new Date().toISOString(),
    path: c.req.path,
  }
}

function respond(c: Context, status: ContentfulStatusCode, code: string, message: string, details?: unknown): Response {
  return c.json(buildErrorBody(base(c), code, message, details), status)
}

export function setupErrorHandler(app: OpenAPIHono): void {
  app.onError((error, c) => {
    const fields = requestLogFields(c.req)
    if (error instanceof ZodError) {
      getLogger(c).warn('request rejected', { ...fields, status: 400, code: ERROR_CODE.VALIDATION_ERROR })
      return respond(c, 400, ERROR_CODE.VALIDATION_ERROR, error.issues[0]?.message ?? 'Validation error')
    }
    if (error instanceof HTTPException) {
      getLogger(c).warn('request rejected', { ...fields, status: error.status, code: ERROR_CODE.BAD_REQUEST })
      return respond(c, error.status, ERROR_CODE.BAD_REQUEST, error.message || 'Request failed')
    }
    if (error instanceof AppError) {
      const status = error.statusCode as ContentfulStatusCode
      const meta = { ...fields, status, code: error.code, error }
      if (status < 500) getLogger(c).warn('request rejected', meta)
      else getLogger(c).error('request failed', meta)
      return respond(c, status, error.code, error.message, error.details)
    }
    const databaseError = convertDatabaseError(error)
    if (databaseError) {
      getLogger(c).warn('database constraint rejected request', { ...fields, code: databaseError.code })
      return respond(c, databaseError.statusCode as ContentfulStatusCode, databaseError.code, databaseError.message)
    }
    const unexpected = error instanceof Error ? error : new Error(String(error))
    getLogger(c).error('request failed', { ...fields, status: 500, code: ERROR_CODE.UNEXPECTED_ERROR, error: unexpected })
    const internal = new InternalServerError(process.env.NODE_ENV === 'production' ? undefined : unexpected.message)
    return respond(c, 500, internal.code, internal.message)
  })
}
