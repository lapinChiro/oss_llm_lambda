import type { Insertable, Kysely, Selectable, Transaction, Updateable } from 'kysely'

import { sql } from 'kysely'

export type CrudExecutor<TDatabase> = Kysely<TDatabase> | Transaction<TDatabase>
type TableName<TDatabase> = keyof TDatabase & string
type Row<TDatabase, TTable extends TableName<TDatabase>> = Selectable<TDatabase[TTable]>
interface RuntimeDatabase { records: { uuid: string; [column: string]: unknown } }

export interface Page<T> {
  items: T[]
  total: number
  limit: number | undefined
  offset: number
}

/**
 * Table-agnostic Kysely CRUD primitives. The dynamic table/uuid knowledge lives here;
 * concrete repositories retain exact generated insert/update/row types at the boundary.
 */
export class CrudQueries<TDatabase, TTable extends TableName<TDatabase>> {
  constructor(
    private readonly executor: CrudExecutor<TDatabase>,
    private readonly table: TTable,
  ) {}

  private runtime(): { executor: Kysely<RuntimeDatabase>; table: 'records' } {
    // Kysely expands a runtime `keyof DB` into every table and exceeds TypeScript's union limit.
    // The actual identifier is still the constructor's generated table key; only its compile-time
    // alias is narrowed here. All public inputs/results remain tied to TDatabase[TTable].
    return {
      executor: this.executor as unknown as Kysely<RuntimeDatabase>,
      table: this.table as unknown as 'records',
    }
  }

  async findById(id: string): Promise<Row<TDatabase, TTable> | null> {
    const { executor, table } = this.runtime()
    const result = await executor
      .selectFrom(table)
      .selectAll()
      .where(sql.ref('uuid'), '=', id)
      .executeTakeFirst()
    return result as Row<TDatabase, TTable> | undefined ?? null
  }

  async findMany(options: {
    limit?: number
    offset?: number
    orderBy?: ReadonlyArray<{ column: string; order: 'asc' | 'desc' }>
  } = {}): Promise<Page<Row<TDatabase, TTable>>> {
    const offset = options.offset ?? 0
    const { executor, table } = this.runtime()
    let query = executor.selectFrom(table).selectAll().offset(offset)
    if (options.limit !== undefined) query = query.limit(options.limit)
    for (const order of options.orderBy ?? []) query = query.orderBy(sql.ref(order.column), order.order)
    const [items, count] = await Promise.all([
      query.execute(),
      executor.selectFrom(table).select((builder) => builder.fn.countAll().as('count')).executeTakeFirst(),
    ])
    return {
      items: items as Array<Row<TDatabase, TTable>>,
      total: Number(count?.count ?? 0),
      limit: options.limit,
      offset,
    }
  }

  async create(data: Insertable<TDatabase[TTable]>): Promise<Row<TDatabase, TTable>> {
    const { executor, table } = this.runtime()
    const result = await executor.insertInto(table).values(data).returningAll().executeTakeFirstOrThrow()
    return result as Row<TDatabase, TTable>
  }

  async update(id: string, data: Updateable<TDatabase[TTable]>): Promise<Row<TDatabase, TTable> | null> {
    if (Object.keys(data).length === 0) return this.findById(id)
    const { executor, table } = this.runtime()
    const result = await executor
      .updateTable(table)
      .set(data as Record<string, unknown>)
      .where(sql.ref('uuid'), '=', id)
      .returningAll()
      .executeTakeFirst()
    return result as Row<TDatabase, TTable> | undefined ?? null
  }

  async deleteById(id: string): Promise<boolean> {
    const { executor, table } = this.runtime()
    const result = await executor.deleteFrom(table).where('uuid', '=', id).executeTakeFirst()
    return result.numDeletedRows > 0n
  }

  async exists(id: string): Promise<boolean> {
    const { executor, table } = this.runtime()
    const result = await executor
      .selectFrom(table)
      .select(sql.lit(1).as('exists'))
      .where('uuid', '=', id)
      .executeTakeFirst()
    return result !== undefined
  }
}
