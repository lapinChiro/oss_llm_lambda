import { sql } from 'kysely'

import { createTestDatabase, destroyTestDatabase } from './test-database.js'

describe('PGlite test seam', () => {
  it('provides PostgreSQL semantics through Kysely', async () => {
    const testDatabase = await createTestDatabase()
    try {
      const result = await sql<{ timezone: string }>`select current_setting('timezone') as timezone`
        .execute(testDatabase.database)
      expect(result.rows[0]?.timezone).toBe('UTC')
    } finally {
      await destroyTestDatabase(testDatabase)
    }
  })
})
