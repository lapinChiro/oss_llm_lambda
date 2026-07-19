import { ERROR_CODE } from '@app/shared'

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly isOperational = true,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', code: string = ERROR_CODE.BAD_REQUEST, details?: unknown) {
    super(message, 400, code, true, details)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found', code: string = ERROR_CODE.NOT_FOUND) { super(message, 404, code) }
}
export class ConflictError extends AppError {
  constructor(message = 'Conflict', code: string = ERROR_CODE.CONFLICT, details?: unknown) {
    super(message, 409, code, true, details)
  }
}
export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', code: string = ERROR_CODE.INTERNAL_SERVER_ERROR) {
    super(message, 500, code, false)
  }
}
