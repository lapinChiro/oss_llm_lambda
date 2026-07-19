import { ERROR_CODE, type CreateTodoInput, type Todo, type UpdateTodoInput } from './index.js'

describe('shared API contract', () => {
  it('defines unique error codes', () => {
    expect(new Set(Object.values(ERROR_CODE)).size).toBe(Object.values(ERROR_CODE).length)
  })

  it('keeps the Todo wire contract framework-neutral', () => {
    const todo: Todo = { id: '00000000-0000-4000-8000-000000000001', title: 'Test', completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const create: CreateTodoInput = { title: todo.title }
    const update: UpdateTodoInput = { completed: true }
    expect({ create, update }).toEqual({ create: { title: 'Test' }, update: { completed: true } })
  })
})
