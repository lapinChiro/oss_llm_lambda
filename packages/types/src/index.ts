export interface ApiSuccessResponse<T> { success: true; data: T }
export interface ApiErrorResponse {
  success: false
  message: string
  code: string
  requestId: string
  timestamp: string
  path: string
  details?: unknown
}
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse
export const ERROR_CODE = {
  BAD_REQUEST: 'BAD_REQUEST', VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT', INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR', UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  UNIQUE_VIOLATION: 'UNIQUE_VIOLATION', FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  NOT_NULL_VIOLATION: 'NOT_NULL_VIOLATION', CHECK_VIOLATION: 'CHECK_VIOLATION',
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
} as const
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

export interface Todo {
  id: string
  title: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTodoInput { title: string }
export interface UpdateTodoInput { title?: string; completed?: boolean }
