import type { Todo } from '@app/shared'

import { describe, expect, it, vi } from 'vitest'

import { ApiError } from './errors'
import { createTodosApi } from './todos-api'

const todo: Todo = { id: '1', title: 'Audit template', completed: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' }

describe('Todos API network boundary', () => {
  it('implements the shared list/create/update/delete wire contract', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([todo])))
      .mockResolvedValueOnce(new Response(JSON.stringify(todo), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...todo, completed: true })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const api = createTodosApi(request)

    await expect(api.list()).resolves.toEqual([todo])
    await api.create({ title: todo.title })
    await api.update(todo.id, { completed: true })
    await api.delete(todo.id)

    expect(request.mock.calls).toEqual([
      ['http://localhost:3000/api/todos', undefined],
      ['http://localhost:3000/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: todo.title }) }],
      ['http://localhost:3000/api/todos/1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: true }) }],
      ['http://localhost:3000/api/todos/1', { method: 'DELETE' }],
    ])
  })

  it('preserves the stable API error contract', async () => {
    const response = new Response(JSON.stringify({ message: 'Database unavailable', code: 'DATABASE_CONNECTION_ERROR', requestId: 'request-1' }), { status: 503 })
    await expect(createTodosApi(vi.fn<typeof fetch>().mockResolvedValue(response)).list()).rejects.toEqual(
      new ApiError('Database unavailable', 'DATABASE_CONNECTION_ERROR', 503, 'request-1'),
    )
  })

  it('normalizes a non-JSON gateway failure', async () => {
    const response = new Response('Bad gateway', { status: 502 })
    await expect(createTodosApi(vi.fn<typeof fetch>().mockResolvedValue(response)).list()).rejects.toEqual(
      new ApiError('Request failed with status 502', 'HTTP_ERROR', 502),
    )
  })
})
