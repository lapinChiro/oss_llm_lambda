import type { TodoRow } from '../db/types.js'
import type { TodoRepository } from '../repositories/todo.repository.js'

import { BadRequestError } from '../errors/index.js'

import { TodoService } from './todo.service.js'

const now = new Date('2026-01-02T03:04:05.000Z')
const row: TodoRow = { uuid: '00000000-0000-4000-8000-000000000001', title: 'Todo', completed: false, created_at: now, updated_at: now }

function setup(overrides: Partial<TodoRepository> = {}): {
  service: TodoService
  calls: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
} {
  const create = vi.fn().mockResolvedValue(row)
  const update = vi.fn().mockResolvedValue({ ...row, completed: true })
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [row], total: 1, limit: undefined, offset: 0 }),
    findById: vi.fn().mockResolvedValue(row),
    create,
    update,
    delete: vi.fn().mockResolvedValue(true),
    executeInTransaction: vi.fn(async (callback: (transaction: object) => Promise<unknown>) => callback({})),
    ...overrides,
  } as unknown as TodoRepository
  return { service: new TodoService(repository), calls: { create, update } }
}

describe('TodoService domain rules', () => {
  it('maps database rows to the stable wire contract', async () => {
    const { service } = setup()
    const expected = { id: row.uuid, title: 'Todo', completed: false, createdAt: now.toISOString(), updatedAt: now.toISOString() }
    expect(await service.findMany()).toEqual({ items: [expected] })
    expect(await service.findById(row.uuid)).toEqual(expected)
    expect(await setup({ findById: vi.fn().mockResolvedValue(null) }).service.findById(row.uuid)).toBeNull()
  })

  it('delegates transaction ownership and creates a trimmed incomplete Todo', async () => {
    const { service, calls } = setup()
    await expect(service.executeInTransaction(() => Promise.resolve('result'))).resolves.toBe('result')
    expect(await service.create({ title: '  Todo  ' }, {})).toMatchObject({ id: row.uuid, completed: false })
    expect(calls.create).toHaveBeenCalledWith({ title: 'Todo', completed: false }, {})
  })

  it.each([undefined, 1, '', '   '])('rejects invalid title %j', async (title) => {
    await expect(setup().service.create({ title }, {})).rejects.toMatchObject({
      message: 'Todo title must not be empty', statusCode: 400,
    })
  })

  it('updates only supplied fields and refreshes updated_at', async () => {
    const { service, calls } = setup()
    await expect(service.update(row.uuid, { title: ' Renamed ' }, {})).resolves.toMatchObject({ completed: true })
    const firstUpdate = calls.update.mock.calls[0]?.[1] as Record<string, unknown>
    expect(firstUpdate).toMatchObject({ title: 'Renamed' })
    expect(firstUpdate.updated_at).toBeInstanceOf(Date)
    expect(firstUpdate).not.toHaveProperty('completed')

    await service.update(row.uuid, { completed: false }, {})
    expect(calls.update).toHaveBeenLastCalledWith(row.uuid, expect.objectContaining({ completed: false }), {})
    expect(await setup({ update: vi.fn().mockResolvedValue(null) }).service.update(row.uuid, {}, {})).toBeUndefined()
  })

  it('preserves typed errors and converts unknown repository failures', async () => {
    const typed = new BadRequestError('typed')
    await expect(setup({ create: vi.fn().mockRejectedValue(typed) }).service.create({ title: 'Todo' }, {})).rejects.toBe(typed)
    await expect(setup({ update: vi.fn().mockRejectedValue(new Error('database exploded')) }).service.update(row.uuid, {}, {}))
      .rejects.toMatchObject({ message: 'database exploded', statusCode: 500 })
  })

  it('deletes existing Todos and reports missing ones', async () => {
    await expect(setup().service.delete(row.uuid, {})).resolves.toBeUndefined()
    await expect(setup({ delete: vi.fn().mockResolvedValue(false) }).service.delete(row.uuid, {})).rejects.toMatchObject({
      message: 'Todo not found', statusCode: 404,
    })
    await expect(setup({ delete: vi.fn().mockRejectedValue(new Error('delete failed')) }).service.delete(row.uuid, {}))
      .rejects.toMatchObject({ message: 'delete failed', statusCode: 500 })
  })
})
