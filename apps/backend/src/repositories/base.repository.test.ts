import type { DB } from '../db/generated-types.js'
import type { Kysely, Transaction } from 'kysely'

import { sql } from 'kysely'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase, destroyTestDatabase, type TestDatabase } from '../testing/test-database.js'

import { BaseRepository, type DatabaseExecutor } from './base.repository.js'

class TransactionTestRepository extends BaseRepository {
  static create(database: Kysely<DB>): TransactionTestRepository {
    return new TransactionTestRepository(database)
  }

  exposeDatabase(): Kysely<DB> {
    return this.database
  }

  exposeExecutor(transaction?: Transaction<DB>): DatabaseExecutor {
    return this.getExecutor(transaction)
  }

  exposeWithTransaction<T>(
    transaction: Transaction<DB> | undefined,
    callback: (transaction: Transaction<DB>) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(transaction, callback)
  }

  async insert(executor: DatabaseExecutor, value: string): Promise<void> {
    await sql`insert into transaction_proof (value) values (${value})`.execute(executor)
  }

  async values(): Promise<string[]> {
    const result = await sql<{ value: string }>`select value from transaction_proof order by value`.execute(this.database)
    return result.rows.map(({ value }) => value)
  }
}

describe('BaseRepository transaction policy', () => {
  let testDatabase: TestDatabase
  let repository: TransactionTestRepository

  beforeEach(async () => {
    testDatabase = await createTestDatabase()
    await sql`create table transaction_proof (value text not null)`.execute(testDatabase.database)
    repository = TransactionTestRepository.create(testDatabase.database)
  })

  afterEach(async () => {
    await destroyTestDatabase(testDatabase)
  })

  it('selects the database by default and reuses a supplied transaction', async () => {
    expect(repository.exposeExecutor()).toBe(repository.exposeDatabase())
    await repository.executeInTransaction((transaction) => {
      expect(repository.exposeExecutor(transaction)).toBe(transaction)
      return repository.exposeWithTransaction(transaction, (received) => Promise.resolve(received)).then((received) => {
        expect(received).toBe(transaction)
      })
    })
  })

  it('commits a successful new transaction and returns its result', async () => {
    const result = await repository.exposeWithTransaction(undefined, async (transaction) => {
      await repository.insert(transaction, 'committed')
      return 'result'
    })

    expect(result).toBe('result')
    expect(await repository.values()).toEqual(['committed'])
  })

  it('rolls back a failed new transaction and propagates the error', async () => {
    await expect(repository.executeInTransaction(async (transaction) => {
      await repository.insert(transaction, 'rolled-back')
      throw new Error('rollback proof')
    })).rejects.toThrow('rollback proof')

    expect(await repository.values()).toEqual([])
  })

  it('keeps reused work inside the parent transaction rollback', async () => {
    await expect(repository.executeInTransaction(async (parent) => {
      await repository.exposeWithTransaction(parent, (transaction) => repository.insert(transaction, 'nested'))
      throw new Error('parent rollback')
    })).rejects.toThrow('parent rollback')

    expect(await repository.values()).toEqual([])
  })
})
