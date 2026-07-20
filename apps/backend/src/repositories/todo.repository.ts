import type { DB } from '../db/generated-types.js'
import type { NewTodoRow, TodoRow, TodoRowUpdate } from '../db/types.js'
import type { OrderBy } from '../utils/crud-handlers.js'
import type { Transaction } from 'kysely'

import { BaseRepository } from './base.repository.js'
import { CrudQueries } from './crud.repository.js'

export class TodoRepository extends BaseRepository {
  findMany(options: { orderBy: OrderBy }): Promise<{ items: TodoRow[]; total: number; limit: number | undefined; offset: number }> {
    return new CrudQueries(this.database, 'todos').findMany(options)
  }

  findById(id: string): Promise<TodoRow | null> {
    return new CrudQueries(this.database, 'todos').findById(id)
  }

  create(data: NewTodoRow, transaction: Transaction<DB>): Promise<TodoRow> {
    return new CrudQueries(transaction, 'todos').create(data)
  }

  update(id: string, data: TodoRowUpdate, transaction: Transaction<DB>): Promise<TodoRow | null> {
    return new CrudQueries(transaction, 'todos').update(id, data)
  }

  async delete(id: string, transaction: Transaction<DB>): Promise<boolean> {
    return new CrudQueries(transaction, 'todos').deleteById(id)
  }
}
