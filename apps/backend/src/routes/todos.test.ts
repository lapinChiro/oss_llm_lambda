import type { ApiErrorResponse } from '@app/shared'

import { z } from '@hono/zod-openapi'
import { afterEach, beforeEach } from 'vitest'

import { buildApp } from '../app.js'
import { TodoRepository } from '../repositories/todo.repository.js'
import { successResponseSchema } from '../schemas/common.js'
import { TodoSchema } from '../schemas/todos.js'
import { ApiTester } from '../testing/api-tester.js'
import { createMigratedTestDatabase, destroyTestDatabase, type TestDatabase } from '../testing/test-database.js'
import { TodoDataFactory } from '../testing/todo-data-factory.js'

describe('/api/todos', () => {
  let testDatabase: TestDatabase
  let api: ApiTester
  let factory: TodoDataFactory

  beforeEach(async () => {
    testDatabase = await createMigratedTestDatabase()
    api = new ApiTester(buildApp(testDatabase.database))
    factory = new TodoDataFactory(new TodoRepository(testDatabase.database))
  })
  afterEach(async () => { await destroyTestDatabase(testDatabase) })

  it('lists, creates, updates/toggles, reads, and deletes Todos', async () => {
    await factory.create({ title: 'Existing', completed: true })
    const list = await api.get('/api/todos', successResponseSchema(z.array(TodoSchema)))
    expect(list.data.data).toHaveLength(1)

    const created = await api.post('/api/todos', { title: '  Ship template  ' }, successResponseSchema(TodoSchema))
    expect(created.status).toBe(201)
    expect(created.data.data).toMatchObject({ title: 'Ship template', completed: false })

    const updated = await api.put(`/api/todos/${created.data.data.id}`, { title: 'Renamed', completed: true }, successResponseSchema(TodoSchema))
    expect(updated.data.data).toMatchObject({ title: 'Renamed', completed: true })
    expect((await api.get(`/api/todos/${created.data.data.id}`, successResponseSchema(TodoSchema))).data.data).toEqual(updated.data.data)
    expect((await api.delete(`/api/todos/${created.data.data.id}`)).status).toBe(204)
  })

  it('returns one stable error contract for validation, not-found, and DB constraints', async () => {
    const validation = await api.post<ApiErrorResponse>('/api/todos', { title: '   ' })
    expect(validation.status).toBe(400)
    expect(validation.data).toMatchObject({ success: false, code: 'VALIDATION_ERROR', path: '/api/todos' })

    const missingId = '00000000-0000-4000-8000-000000000000'
    const missing = await api.delete<ApiErrorResponse>(`/api/todos/${missingId}`)
    expect(missing.status).toBe(404)
    expect(missing.data).toMatchObject({ success: false, code: 'NOT_FOUND' })
    expect((await api.get<ApiErrorResponse>(`/api/todos/${missingId}`)).status).toBe(404)
    expect((await api.put<ApiErrorResponse>(`/api/todos/${missingId}`, { completed: true })).status).toBe(404)
    expect((await api.put<ApiErrorResponse>(`/api/todos/${missingId}`, {})).status).toBe(400)

    const repository = new TodoRepository(testDatabase.database)
    await expect(repository.executeInTransaction((transaction) => repository.create({ title: ' ' }, transaction))).rejects.toThrow()
  })

  it('publishes every Todo operation in OpenAPI', async () => {
    const document = await (await buildApp(testDatabase.database).request('/openapi.json')).json() as { paths: Record<string, Record<string, unknown>> }
    expect(Object.keys(document.paths['/api/todos'] ?? {})).toEqual(expect.arrayContaining(['get', 'post']))
    expect(Object.keys(document.paths['/api/todos/{uuid}'] ?? {})).toEqual(expect.arrayContaining(['get', 'put', 'delete']))
  })
})
