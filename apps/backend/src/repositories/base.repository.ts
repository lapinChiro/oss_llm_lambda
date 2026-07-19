import type { DB } from '../db/generated-types.js'
import type { Kysely, Transaction } from 'kysely'

import { TransactionManager } from '../db/transaction-manager.js'

export type DatabaseExecutor = Kysely<DB> | Transaction<DB>

/** Shared repository transaction policy: reuse a supplied transaction or open one. */
export abstract class BaseRepository {
  protected readonly transactionManager: TransactionManager

  constructor(protected readonly database: Kysely<DB>) {
    this.transactionManager = new TransactionManager(database)
  }

  protected getExecutor(transaction?: Transaction<DB>): DatabaseExecutor {
    return transaction ?? this.database
  }

  executeInTransaction<T>(callback: (transaction: Transaction<DB>) => Promise<T>): Promise<T> {
    return this.transactionManager.execute(callback)
  }

  protected withTransaction<T>(
    transaction: Transaction<DB> | undefined,
    callback: (transaction: Transaction<DB>) => Promise<T>,
  ): Promise<T> {
    return transaction ? callback(transaction) : this.executeInTransaction(callback)
  }
}
