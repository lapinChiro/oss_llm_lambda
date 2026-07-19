import { ERROR_CODE } from '@app/shared'

import { AppError, BadRequestError, ConflictError, InternalServerError } from './app-errors.js'

function readableIdentifier(identifier: string): string {
  return identifier.replaceAll('_', ' ')
}

export function convertDatabaseError(error: unknown): AppError | undefined {
  if (error instanceof AppError) return error
  // Stryker disable next-line ConditionalExpression,LogicalOperator: invalid shapes and unknown codes share undefined.
  if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'string') return undefined

  switch (error.code) {
    case '23505':
      return new ConflictError(
        'constraint' in error && typeof error.constraint === 'string'
          ? `Duplicate value for ${readableIdentifier(error.constraint)}`
          : 'Duplicate value',
        ERROR_CODE.UNIQUE_VIOLATION,
      )
    case '23503':
      return new BadRequestError('Invalid reference to related resource', ERROR_CODE.FOREIGN_KEY_VIOLATION)
    case '23502':
      return new BadRequestError(
        'column' in error && typeof error.column === 'string'
          ? `Required field '${readableIdentifier(error.column)}' is missing`
          : 'Required field is missing',
        ERROR_CODE.NOT_NULL_VIOLATION,
      )
    case '23514':
      return new BadRequestError('Value violates a database constraint', ERROR_CODE.CHECK_VIOLATION)
    case '08000':
    case '08003':
    case '08006':
      return new InternalServerError('Database connection error', ERROR_CODE.DATABASE_CONNECTION_ERROR)
    // Stryker disable next-line ConditionalExpression: an unknown PostgreSQL code intentionally maps to undefined.
    default:
      return undefined
  }
}

/** Repository/service boundary variant: always returns a typed application error. */
export function toAppError(error: unknown): AppError {
  return convertDatabaseError(error) ?? new InternalServerError(
    error instanceof Error ? error.message : 'Unexpected database error',
  )
}
