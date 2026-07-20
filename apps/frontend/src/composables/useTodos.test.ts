import type { TodosApi } from '@/api/todos-api'
import type { Todo } from '@app/shared'

/* oxlint-disable typescript/unbound-method -- Vitest mock assertions inspect function objects intentionally. */
import { describe, expect, it, vi } from 'vitest'

import { useTodos } from './useTodos'

const first: Todo = { id: '1', title: 'Ship template', completed: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' }
const second: Todo = { ...first, id: '2', title: 'Test template' }
const api = (overrides: Partial<TodosApi> = {}): TodosApi => ({
  list: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn(), ...overrides,
})

describe('useTodos', () => {
  it('reports pending, success, and stable list errors', async () => {
    let resolveList: ((todos: Todo[]) => void) | undefined
    const state = useTodos(api({ list: vi.fn().mockReturnValue(new Promise<Todo[]>(resolve => { resolveList = resolve })) }))
    expect(state.isLoading.value).toBe(false)
    expect(state.isMutating.value).toBe(false)
    const load = state.load()
    expect(state.isLoading.value).toBe(true)
    resolveList?.([first])
    await load
    expect(state.todos.value).toEqual([first])
    expect(state.isLoading.value).toBe(false)

    const failed = useTodos(api({ list: vi.fn().mockRejectedValue(new Error('network')) }))
    await failed.load()
    expect(failed.errorMessage.value).toBe('Todos could not be loaded. Try again.')
  })

  it('uses only the latest overlapping reload for data, error, and loading state', async () => {
    let rejectFirst: ((error: Error) => void) | undefined
    let resolveSecond: ((todos: Todo[]) => void) | undefined
    const client = api({ list: vi.fn()
      .mockReturnValueOnce(new Promise<Todo[]>((_resolve, reject) => { rejectFirst = reject }))
      .mockReturnValueOnce(new Promise<Todo[]>(resolve => { resolveSecond = resolve })) })
    const state = useTodos(client)
    const oldLoad = state.load()
    const latestLoad = state.load()
    rejectFirst?.(new Error('stale failure'))
    await oldLoad
    expect(state.errorMessage.value).toBeUndefined()
    expect(state.isLoading.value).toBe(true)
    resolveSecond?.([second])
    await latestLoad
    expect(state.todos.value).toEqual([second])
    expect(state.isLoading.value).toBe(false)
  })

  it('validates and trims creation, then handles toggle and delete pessimistically', async () => {
    const client = api({
      list: vi.fn().mockResolvedValue([first]),
      create: vi.fn().mockResolvedValue(second),
      update: vi.fn().mockResolvedValue({ ...first, completed: true }),
      delete: vi.fn().mockResolvedValue(undefined),
    })
    const state = useTodos(client)
    await state.load()
    await expect(state.create('   ')).resolves.toBe(false)
    expect(client.create).not.toHaveBeenCalled()
    await expect(state.create('  Test template  ')).resolves.toBe(true)
    expect(client.create).toHaveBeenCalledWith({ title: 'Test template' })
    expect(state.todos.value).toEqual([second, first])
    await state.toggle(first)
    expect(client.update).toHaveBeenCalledWith('1', { completed: true })
    expect(state.todos.value[1]?.completed).toBe(true)
    await state.remove('2')
    expect(state.todos.value).toEqual([{ ...first, completed: true }])
  })

  it('serializes mutations and ignores a reload made stale by a mutation', async () => {
    let resolveList: ((todos: Todo[]) => void) | undefined
    let resolveCreate: ((todo: Todo) => void) | undefined
    const client = api({
      list: vi.fn().mockReturnValue(new Promise<Todo[]>(resolve => { resolveList = resolve })),
      create: vi.fn().mockReturnValue(new Promise<Todo>(resolve => { resolveCreate = resolve })),
      delete: vi.fn().mockResolvedValue(undefined),
    })
    const state = useTodos(client)
    const load = state.load()
    const create = state.create(second.title)
    const remove = state.remove('2')
    expect(state.isLoading.value).toBe(false)
    expect(state.isMutating.value).toBe(true)
    expect(client.delete).not.toHaveBeenCalled()
    resolveList?.([first])
    await load
    expect(state.todos.value).toEqual([])
    resolveCreate?.(second)
    await create
    expect(state.isMutating.value).toBe(true)
    await remove
    expect(client.delete).toHaveBeenCalledOnce()
    expect(state.todos.value).toEqual([])
    expect(state.isMutating.value).toBe(false)
  })

  it('keeps current data and exposes a stable mutation failure', async () => {
    const client = api({
      list: vi.fn().mockResolvedValue([first]),
      create: vi.fn().mockRejectedValue(new Error('offline')),
      update: vi.fn().mockRejectedValue(new Error('offline')),
    })
    const state = useTodos(client)
    await state.load()
    await state.toggle(first)
    expect(state.todos.value).toEqual([first])
    expect(state.errorMessage.value).toBe('Your change could not be saved. Try again.')
    await expect(state.create('Will fail')).resolves.toBe(false)
  })
})
