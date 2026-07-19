import type { TodoRepository } from '../repositories/todo.repository.js'
import type { Todo } from '@app/shared'

export class TodoDataFactory {
  private sequence = 0

  constructor(private readonly repository: TodoRepository) {}

  create(overrides: { title?: string; completed?: boolean } = {}): Promise<Todo> {
    this.sequence += 1
    return this.repository.executeInTransaction(async (transaction) => {
      const row = await this.repository.create({
        title: overrides.title ?? `Todo ${this.sequence}`,
        completed: overrides.completed ?? false,
      }, transaction)
      return {
        id: row.uuid, title: row.title, completed: row.completed,
        createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
      }
    })
  }
}
