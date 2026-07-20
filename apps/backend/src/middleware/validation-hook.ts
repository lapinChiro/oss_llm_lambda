import type { Hook } from '@hono/zod-openapi'
import type { Env } from 'hono'

import { ERROR_CODE } from '@app/shared'

import { buildErrorBody } from './error-handler.js'
import { generateRequestId } from './request-context.js'

export function createValidationHook<E extends Env = Env>(): Hook<unknown, E, string, unknown> {
  return (result, c) => {
    if (result.success) return undefined
    const first = result.error.issues[0]
    const message = `${first.path.join('.')}: ${first.message}`.replace(/^: /, '')
    return c.json(buildErrorBody({
      success: false,
      requestId: c.get('requestId') ?? generateRequestId(),
      timestamp: new Date().toISOString(),
      path: c.req.path,
    }, ERROR_CODE.VALIDATION_ERROR, message), 400)
  }
}
