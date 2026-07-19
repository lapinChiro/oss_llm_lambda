import type { DB } from '../db/generated-types.js'
import type { TodoRow } from '../db/types.js'
import type { TodoRepository } from '../repositories/todo.repository.js'
import type { Todo } from '@app/shared'
import type { Transaction } from 'kysely'

import { BadRequestError, NotFoundError, toAppError } from '../errors/index.js'

function toTodo(row: TodoRow): Todo {
  return {
    id: row.uuid,
    title: row.title,
    completed: row.completed,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class TodoService {
  constructor(private readonly repository: TodoRepository) {}

  async findMany(): Promise<{ items: Todo[] }> {
    const page = await this.repository.findMany()
    return { items: page.items.map(toTodo) }
  }

  async findById(id: string): Promise<Todo | null> {
    const row = await this.repository.findById(id)
    return row ? toTodo(row) : null
  }

  executeInTransaction<T>(callback: (transaction: unknown) => Promise<T>): Promise<T> {
    return this.repository.executeInTransaction(callback)
  }

  async create(data: Record<string, unknown>, transaction: unknown): Promise<Todo> {
    try {
      const title = this.title(data.title)
      return toTodo(await this.repository.create({ title, completed: false }, transaction as Transaction<DB>))
    } catch (error) { throw toAppError(error) }
  }

  async update(id: string, data: Record<string, unknown>, transaction: unknown): Promise<Todo | undefined> {
    try {
      const update = {
        ...(data.title === undefined ? {} : { title: this.title(data.title) }),
        ...(data.completed === undefined ? {} : { completed: data.completed as boolean }),
        updated_at: new Date(),
      }
      const row = await this.repository.update(id, update, transaction as Transaction<DB>)
      return row ? toTodo(row) : undefined
    } catch (error) { throw toAppError(error) }
  }

  async delete(id: string, transaction: unknown): Promise<void> {
    try {
      if (!await this.repository.delete(id, transaction as Transaction<DB>)) throw new NotFoundError('Todo not found')
    } catch (error) { throw toAppError(error) }
  }

  private title(value: unknown): string {
    if (typeof value !== 'string' || value.trim() === '') throw new BadRequestError('Todo title must not be empty')
    return value.trim()
  }
}
