import type { PGlite } from '@electric-sql/pglite'
import type {
  DatabaseConnection, DatabaseIntrospector, Dialect, DialectAdapter, Driver, Kysely,
  QueryCompiler, QueryResult, TransactionSettings,
} from 'kysely'

import {
  CompiledQuery, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler,
} from 'kysely'

class PGliteConnection implements DatabaseConnection {
  constructor(private readonly client: PGlite) {}

  async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    const result = await this.client.query<R>(query.sql, [...query.parameters])
    return {
      rows: result.rows,
      numAffectedRows: result.affectedRows === undefined ? undefined : BigInt(result.affectedRows),
    }
  }

  async *streamQuery<R>(query: CompiledQuery, chunkSize: number): AsyncIterableIterator<QueryResult<R>> {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) throw new Error('chunkSize must be a positive integer')
    const { rows } = await this.client.query<R>(query.sql, [...query.parameters])
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      yield { rows: rows.slice(offset, offset + chunkSize) }
    }
  }
}

class PGliteDriver implements Driver {
  private connection: DatabaseConnection | undefined
  private readonly waiting: Array<(connection: DatabaseConnection) => void> = []

  constructor(private readonly client: PGlite) {}
  init(): Promise<void> { return Promise.resolve() }
  destroy(): Promise<void> { return this.client.close() }

  acquireConnection(): Promise<DatabaseConnection> {
    if (this.connection) return new Promise((resolve) => this.waiting.push(resolve))
    this.connection = new PGliteConnection(this.client)
    return Promise.resolve(this.connection)
  }

  releaseConnection(connection: DatabaseConnection): Promise<void> {
    if (connection !== this.connection) throw new Error('Invalid PGlite connection')
    const next = this.waiting.shift()
    if (next) next(connection)
    else this.connection = undefined
    return Promise.resolve()
  }

  beginTransaction(connection: DatabaseConnection, settings: TransactionSettings): Promise<void> {
    const suffix = settings.isolationLevel ? ` isolation level ${settings.isolationLevel}` : ''
    return connection.executeQuery(CompiledQuery.raw(`begin${suffix}`)).then(() => undefined)
  }
  commitTransaction(connection: DatabaseConnection): Promise<void> {
    return connection.executeQuery(CompiledQuery.raw('commit')).then(() => undefined)
  }
  rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    return connection.executeQuery(CompiledQuery.raw('rollback')).then(() => undefined)
  }
}

/** Kysely dialect for the in-process PostgreSQL integration-test seam. */
export class PGliteDialect implements Dialect {
  constructor(private readonly client: PGlite) {}
  createAdapter(): DialectAdapter { return new PostgresAdapter() }
  createDriver(): Driver { return new PGliteDriver(this.client) }
  createIntrospector(database: Kysely<unknown>): DatabaseIntrospector { return new PostgresIntrospector(database) }
  createQueryCompiler(): QueryCompiler { return new PostgresQueryCompiler() }
}
