import type { ApiErrorResponse } from '@app/shared'

import { z } from '@hono/zod-openapi'

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.string(),
  requestId: z.string(),
  timestamp: z.iso.datetime(),
  path: z.string(),
  details: z.unknown().optional(),
}).openapi('ErrorResponse') satisfies z.ZodType<ApiErrorResponse>

export const VALIDATION_ERROR_DESCRIPTION = 'Validation error'
export const NOT_FOUND_DESCRIPTION = 'Resource not found'
export const DATABASE_ERROR_DESCRIPTION = 'Database error'

export function errorResponse(description: string): {
  content: Record<string, { schema: typeof ErrorResponseSchema }>
  description: string
} {
  return { content: { 'application/json': { schema: ErrorResponseSchema } }, description }
}

export function successResponseSchema<T>(schema: z.ZodType<T>): z.ZodType<{ success: true; data: T }> {
  return z.object({ success: z.literal(true), data: schema })
}

export function successResponse(schema: z.ZodType, description: string): {
  content: Record<string, { schema: z.ZodType }>
  description: string
} {
  return { content: { 'application/json': { schema: successResponseSchema(schema) } }, description }
}
