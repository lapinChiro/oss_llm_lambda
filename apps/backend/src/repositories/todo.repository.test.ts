import { afterEach, beforeEach } from 'vitest'

import { QueryProbe } from '../testing/query-probe.js'
import { createMigratedTestDatabase, destroyTestDatabase, type TestDatabase } from '../testing/test-database.js'

import { TodoRepository } from './todo.repository.js'

describe('TodoRepository', () => {
  let testDatabase: TestDatabase
  let repository: TodoRepository

  beforeEach(async () => {
    testDatabase = await createMigratedTestDatabase()
    repository = new TodoRepository(testDatabase.database)
  })
  afterEach(async () => { await destroyTestDatabase(testDatabase) })

  const listOrderBy = [{ column: 'created_at', order: 'desc' }, { column: 'uuid', order: 'desc' }] as const

  it('uses every CRUD primitive against the generated todos table', async () => {
    const created = await repository.executeInTransaction((transaction) => repository.create({ title: 'Write tests' }, transaction))
    expect((await repository.findById(created.uuid))?.title).toBe('Write tests')
    expect((await repository.findMany({ orderBy: listOrderBy })).items).toHaveLength(1)
    const updated = await repository.executeInTransaction((transaction) => repository.update(created.uuid, { completed: true }, transaction))
    expect(updated?.completed).toBe(true)
    expect(await repository.executeInTransaction((transaction) => repository.delete(created.uuid, transaction))).toBe(true)
    expect(await repository.findById(created.uuid)).toBeNull()
  })

  it('applies the caller-supplied sort order to the query', async () => {
    await testDatabase.database.insertInto('todos').values([{ title: 'B' }, { title: 'A' }, { title: 'C' }]).execute()
    const ascending = await repository.findMany({ orderBy: [{ column: 'title', order: 'asc' }] })
    expect(ascending.items.map((item) => item.title)).toEqual(['A', 'B', 'C'])
    const descending = await repository.findMany({ orderBy: [{ column: 'title', order: 'desc' }] })
    expect(descending.items.map((item) => item.title)).toEqual(['C', 'B', 'A'])
  })

  it('keeps list query count constant as rows grow', async () => {
    const factoryRows = Array.from({ length: 12 }, (_, index) => ({ title: `Todo ${index}` }))
    await testDatabase.database.insertInto('todos').values(factoryRows).execute()
    const probe = new QueryProbe()
    repository = new TodoRepository(testDatabase.database.withPlugin(probe))
    probe.reset()
    expect((await repository.findMany({ orderBy: listOrderBy })).items).toHaveLength(12)
    expect(probe.count).toBe(2)
  })
})
