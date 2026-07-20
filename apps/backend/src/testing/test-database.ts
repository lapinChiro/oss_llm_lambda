import type { DB } from '../db/generated-types.js'
import type { PGliteOptions } from '@electric-sql/pglite'

import { PGlite, types } from '@electric-sql/pglite'
import { Kysely, sql } from 'kysely'

import { migrateToLatest } from '../db/migrate.js'

import { PGliteDialect } from './pglite-dialect.js'

export interface TestDatabase { database: Kysely<DB>; client: PGlite }

/** Creates an isolated database; a per-run snapshot Blob may be supplied by global setup. */
export async function createTestDatabase(snapshot?: Blob): Promise<TestDatabase> {
  const options: PGliteOptions = {
    ...(snapshot ? { loadDataDir: snapshot } : {}),
    parsers: { [types.DATE]: (value) => value },
  }
  const client = new PGlite(options)
  await client.waitReady
  const database = new Kysely<DB>({ dialect: new PGliteDialect(client) })
  await sql`set timezone to 'UTC'`.execute(database)
  return { database, client }
}

export async function destroyTestDatabase(testDatabase: TestDatabase): Promise<void> {
  await testDatabase.database.destroy()
}

export async function createMigratedTestDatabase(): Promise<TestDatabase> {
  const testDatabase = await createTestDatabase()
  await migrateToLatest(testDatabase.database)
  return testDatabase
}
