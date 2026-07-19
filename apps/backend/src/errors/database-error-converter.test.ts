import { BadRequestError, ConflictError, InternalServerError } from './app-errors.js'
import { convertDatabaseError, toAppError } from './database-error-converter.js'

describe('database error conversion', () => {
  it('preserves an existing typed application error', () => {
    const typed = new ConflictError('known')
    expect(toAppError(typed)).toBe(typed)
  })

  it.each([
    [{ code: '23505', constraint: 'todos_title_key' }, ConflictError, 409, 'UNIQUE_VIOLATION', 'Duplicate value for todos title key'],
    [{ code: '23505' }, ConflictError, 409, 'UNIQUE_VIOLATION', 'Duplicate value'],
    [{ code: '23505', constraint: 42 }, ConflictError, 409, 'UNIQUE_VIOLATION', 'Duplicate value'],
    [{ code: '23503' }, BadRequestError, 400, 'FOREIGN_KEY_VIOLATION', 'Invalid reference to related resource'],
    [{ code: '23502', column: 'todo_title' }, BadRequestError, 400, 'NOT_NULL_VIOLATION', "Required field 'todo title' is missing"],
    [{ code: '23502' }, BadRequestError, 400, 'NOT_NULL_VIOLATION', 'Required field is missing'],
    [{ code: '23502', column: 42 }, BadRequestError, 400, 'NOT_NULL_VIOLATION', 'Required field is missing'],
    [{ code: '23514' }, BadRequestError, 400, 'CHECK_VIOLATION', 'Value violates a database constraint'],
    [{ code: '08000' }, InternalServerError, 500, 'DATABASE_CONNECTION_ERROR', 'Database connection error'],
    [{ code: '08003' }, InternalServerError, 500, 'DATABASE_CONNECTION_ERROR', 'Database connection error'],
    [{ code: '08006' }, InternalServerError, 500, 'DATABASE_CONNECTION_ERROR', 'Database connection error'],
  ] as const)('maps PostgreSQL error %# to its stable application contract', (properties, ErrorType, statusCode, code, message) => {
    const error = Object.assign(new Error('database failure'), properties)
    const converted = convertDatabaseError(error)
    expect(converted).toBeInstanceOf(ErrorType)
    expect(converted).toMatchObject({ statusCode, code, message })
  })

  it.each([
    'failure',
    new Error('missing code'),
    Object.assign(new Error('numeric code'), { code: 23_505 }),
    Object.assign(new Error('lowercase code'), { code: 'abcde' }),
    Object.assign(new Error('short code'), { code: '2350' }),
    Object.assign(new Error('long code'), { code: '235050' }),
    Object.assign(new Error('unknown code'), { code: '99999' }),
  ])('does not misclassify a non-PostgreSQL or unknown error %#', (error) => {
    expect(convertDatabaseError(error)).toBeUndefined()
  })

  it('wraps unknown errors at the typed repository boundary without losing useful messages', () => {
    const error = toAppError(new Error('driver failed'))
    expect(error).toBeInstanceOf(InternalServerError)
    expect(error.message).toBe('driver failed')

    const nonError = toAppError('failure')
    expect(nonError).toBeInstanceOf(InternalServerError)
    expect(nonError.message).toBe('Unexpected database error')
  })
})
