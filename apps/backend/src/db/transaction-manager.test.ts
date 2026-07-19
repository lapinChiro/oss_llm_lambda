import type { DB } from './generated-types.js'
import type { IsolationLevel, Kysely, Transaction } from 'kysely'

import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  TransactionManager,
  executeWithRetry,
  type TransactionOptions
} from './transaction-manager.js'

// Set required environment variable before importing modules
process.env.DB_PASSWORD = 'test-for-import'

// Type definition for transaction builder
interface TransactionBuilder<T> {
  execute: (callback: (trx: Transaction<DB>) => Promise<T>) => Promise<T>
}

// Type definition for mock transaction function
type MockTransactionFunction = <T>() => TransactionBuilder<T>

// Create a properly typed mock transaction
const createMockTransaction = (): Transaction<DB> => {
  const mockTransaction = {
    execute: vi.fn(),
    insertInto: vi.fn().mockReturnThis(),
    selectFrom: vi.fn().mockReturnThis(),
    updateTable: vi.fn().mockReturnThis(),
    deleteFrom: vi.fn().mockReturnThis(),
  } as unknown as Transaction<DB>
  
  return mockTransaction
}

// Create mock database with proper typing
const createMockDb = () => {
  const mockTransaction = createMockTransaction()
  
  // Create a mock execute function
  const mockExecute = vi.fn(async <T>(callback: (trx: Transaction<DB>) => Promise<T>): Promise<T> => {
    return await callback(mockTransaction)
  })
  
  // Create a mock transaction builder
  const createTransactionBuilder = <T>(): TransactionBuilder<T> => ({
    execute: mockExecute as (callback: (trx: Transaction<DB>) => Promise<T>) => Promise<T>
  })
  
  // Create the transaction mock function
  const transactionMock = vi.fn(createTransactionBuilder) as unknown as MockTransactionFunction
  
  const mockDb = {
    transaction: transactionMock,
    insertInto: vi.fn().mockReturnThis(),
    selectFrom: vi.fn().mockReturnThis(),
    updateTable: vi.fn().mockReturnThis(),
    deleteFrom: vi.fn().mockReturnThis(),
  } as unknown as Kysely<DB>

  return { mockDb, mockTransaction, transactionMock, mockExecute }
}

describe('TransactionManager', () => {
  let mockDb: Kysely<DB>
  let mockTransaction: Transaction<DB>
  let transactionMock: MockTransactionFunction
  beforeEach(() => {
    vi.clearAllMocks()
    const mocks = createMockDb()
    mockDb = mocks.mockDb
    mockTransaction = mocks.mockTransaction
    transactionMock = mocks.transactionMock
  })

  describe('constructor', () => {
    it('should create TransactionManager with database instance', () => {
      const manager = new TransactionManager(mockDb)
      expect(manager).toBeInstanceOf(TransactionManager)
    })
  })

  describe('execute', () => {
    it('should execute simple transaction successfully', async () => {
      const manager = new TransactionManager(mockDb)
      const callback = vi.fn().mockResolvedValue('test-result')

      const result = await manager.execute(callback)

      expect(transactionMock).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(mockTransaction)
      expect(result).toBe('test-result')
    })

    it('should set isolation level when specified', async () => {
      const manager = new TransactionManager(mockDb)
      const callback = vi.fn().mockResolvedValue('test-result')
      const options: TransactionOptions = { isolationLevel: 'serializable' }

      const result = await manager.execute(callback, options)

      expect(callback).toHaveBeenCalledWith(mockTransaction)
      expect(result).toBe('test-result')
    })

    it('should handle callback errors and rollback automatically', async () => {
      const manager = new TransactionManager(mockDb)
      const error = new Error('Test error')
      const callback = vi.fn().mockRejectedValue(error)

      await expect(manager.execute(callback)).rejects.toThrow('Test error')
    })

    it('should reject invalid isolation level', async () => {
      const manager = new TransactionManager(mockDb)
      const callback = vi.fn()

      await expect(
        manager.execute(callback, { isolationLevel: 'INVALID' as IsolationLevel })
      ).rejects.toThrow('Invalid isolation level')
    })
  })

})

describe('executeWithRetry', () => {
  let mockDb: Kysely<DB>

  beforeEach(() => {
    vi.clearAllMocks()
    const mocks = createMockDb()
    mockDb = mocks.mockDb
  })

  it('should execute successfully on first attempt', async () => {
    const manager = new TransactionManager(mockDb)
    const callback = vi.fn().mockResolvedValue('success')

    const result = await executeWithRetry(manager, callback)

    expect(result).toBe('success')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should retry on serialization error', async () => {
    const manager = new TransactionManager(mockDb)
    let attemptCount = 0
    const totalAttempts = 3

    const executeSpy = vi.spyOn(manager, 'execute')
    executeSpy.mockImplementation(() => Promise.resolve().then(() => {
      attemptCount++
      if (attemptCount < totalAttempts) {
        const error = new Error('Serialization error') as Error & { code: string }
        error.code = '40001'
        throw error
      }
      return 'success-after-retry' as never
    }))

    const callback = vi.fn()
    const result = await executeWithRetry(manager, callback, { maxRetries: 3, initialDelay: 1 })

    expect(result).toBe('success-after-retry')
    expect(attemptCount).toBe(totalAttempts)
  })

  it('should throw non-serialization errors immediately', async () => {
    const manager = new TransactionManager(mockDb)
    const normalError = new Error('Normal error')
    const callback = vi.fn().mockRejectedValue(normalError)

    await expect(executeWithRetry(manager, callback)).rejects.toThrow('Normal error')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should handle deadlock errors (40P01) as retryable', async () => {
    const manager = new TransactionManager(mockDb)
    let attemptCount = 0

    const executeSpy = vi.spyOn(manager, 'execute')
    executeSpy.mockImplementation(() => Promise.resolve().then(() => {
      attemptCount++
      if (attemptCount < 2) {
        const error = new Error('Deadlock') as Error & { code: string }
        error.code = '40P01'
        throw error
      }
      return 'success' as never
    }))

    const callback = vi.fn()
    const result = await executeWithRetry(manager, callback, { maxRetries: 3, initialDelay: 1 })

    expect(result).toBe('success')
    expect(attemptCount).toBe(2)
  })

  it('should throw after max retries', async () => {
    const manager = new TransactionManager(mockDb)
    const error = new Error('Serialization error') as Error & { code: string }
    error.code = '40001'
    const callback = vi.fn().mockRejectedValue(error)

    await expect(
      executeWithRetry(manager, callback, { maxRetries: 2, initialDelay: 1 })
    ).rejects.toThrow('Serialization error')
    
    // Initial attempt + 2 retries = 3 total
    expect(callback).toHaveBeenCalledTimes(3)
  })
})