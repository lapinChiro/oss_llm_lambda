import { sql } from 'kysely'

import { createTestDatabase, destroyTestDatabase, type TestDatabase } from '../testing/test-database.js'

import { migrateDown, migrateToLatest } from './migrate.js'

describe('fresh Todo migration', () => {
  let testDatabase: TestDatabase
  beforeEach(async () => { testDatabase = await createTestDatabase() })
  afterEach(async () => { await destroyTestDatabase(testDatabase) })

  it('supports up, down, and up again from an empty database', async () => {
    await migrateToLatest(testDatabase.database)
    expect((await sql<{ name: string }>`select table_name as name from information_schema.tables where table_name = 'todos'`.execute(testDatabase.database)).rows).toEqual([{ name: 'todos' }])
    await migrateDown(testDatabase.database)
    expect((await sql`select 1 from information_schema.tables where table_name = 'todos'`.execute(testDatabase.database)).rows).toEqual([])
    await migrateToLatest(testDatabase.database)
  })

  it('enforces UUID/default/timestamp/title invariants without product seed data', async () => {
    await migrateToLatest(testDatabase.database)
    const inserted = await testDatabase.database.insertInto('todos').values({ title: 'Synthetic todo' }).returningAll().executeTakeFirstOrThrow()
    expect(inserted.uuid).toMatch(/^[0-9a-f-]{36}$/)
    expect(inserted.completed).toBe(false)
    expect(inserted.created_at).toBeInstanceOf(Date)
    expect(inserted.updated_at).toBeInstanceOf(Date)
    await expect(testDatabase.database.insertInto('todos').values({ title: '   ' }).execute()).rejects.toThrow()
  })
})
