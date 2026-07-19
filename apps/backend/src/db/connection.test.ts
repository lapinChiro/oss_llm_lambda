import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createDatabaseConfig, getDatabase, setDatabase } from './connection.js'

// Set required environment variable before importing connection module
process.env.DB_PASSWORD = 'test-for-import'

// createDatabaseConfig は設定生成中の例外を DatabaseConfigError でラップし、
// 元のエラーを `cause` として保持する。元エラーのメッセージを取り出して検証する。
function getThrownCause(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    return String((error as { cause?: unknown }).cause)
  }
  throw new Error('expected function to throw')
}

describe('Database Connection Configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('createDatabaseConfig', () => {
    describe('Required Environment Variables', () => {
      it('should throw error when DB_PASSWORD is not set', () => {
        delete process.env.DB_PASSWORD

        expect(() => createDatabaseConfig()).toThrow('Failed to create database configuration')
        expect(getThrownCause(() => createDatabaseConfig()))
          .toContain('Missing required environment variable: DB_PASSWORD')
      })

      it('should throw error when DB_PASSWORD is empty string', () => {
        process.env.DB_PASSWORD = ''

        expect(() => createDatabaseConfig()).toThrow('Failed to create database configuration')
        expect(getThrownCause(() => createDatabaseConfig()))
          .toContain('Missing required environment variable: DB_PASSWORD')
      })

      it('should use DB_PASSWORD when set', () => {
        process.env.DB_PASSWORD = 'test-password'

        const config = createDatabaseConfig()

        expect(config.password).toBe('test-password')
      })

      it('should use dbPassword argument when provided', () => {
        delete process.env.DB_PASSWORD

        const config = createDatabaseConfig('injected-password')

        expect(config.password).toBe('injected-password')
      })

      it('should prefer dbPassword argument over DB_PASSWORD env var', () => {
        process.env.DB_PASSWORD = 'env-password'

        const config = createDatabaseConfig('injected-password')

        expect(config.password).toBe('injected-password')
      })
    })

    describe('Optional Environment Variables with Defaults', () => {
      beforeEach(() => {
        process.env.DB_PASSWORD = 'required-password'
      })

      it('should use default values when environment variables are not set', () => {
        delete process.env.DB_HOST
        delete process.env.DB_PORT
        delete process.env.DB_USER
        delete process.env.DB_NAME
        delete process.env.NODE_ENV

        const config = createDatabaseConfig()

        expect(config.host).toBe('localhost')
        expect(config.port).toBe(5432)
        expect(config.user).toBe('postgres')
        expect(config.database).toBe('app_dev')
      })

      it('should use custom values when environment variables are set', () => {
        process.env.DB_HOST = 'custom-host'
        process.env.DB_PORT = '9999'
        process.env.DB_USER = 'custom-user'
        process.env.DB_NAME = 'custom_db'

        const config = createDatabaseConfig()

        expect(config.host).toBe('custom-host')
        expect(config.port).toBe(9999)
        expect(config.user).toBe('custom-user')
        expect(config.database).toBe('custom_db')
      })
    })

    describe('Connection Pool Settings', () => {
      beforeEach(() => {
        process.env.DB_PASSWORD = 'required-password'
      })

      it('should use development defaults when NODE_ENV is not production', () => {
        delete process.env.NODE_ENV
        delete process.env.DB_POOL_MAX
        delete process.env.DB_IDLE_TIMEOUT
        delete process.env.DB_CONNECTION_TIMEOUT

        const config = createDatabaseConfig()

        expect(config.max).toBe(5)
        expect(config.idleTimeoutMillis).toBe(30000)
        expect(config.connectionTimeoutMillis).toBe(2000)
      })

      it('should use development defaults when NODE_ENV is development', () => {
        process.env.NODE_ENV = 'development'
        delete process.env.DB_POOL_MAX
        delete process.env.DB_IDLE_TIMEOUT
        delete process.env.DB_CONNECTION_TIMEOUT

        const config = createDatabaseConfig()

        expect(config.max).toBe(5)
        expect(config.idleTimeoutMillis).toBe(30000)
        expect(config.connectionTimeoutMillis).toBe(2000)
      })

      it('should use production defaults when NODE_ENV is production', () => {
        process.env.NODE_ENV = 'production'
        delete process.env.DB_POOL_MAX
        delete process.env.DB_IDLE_TIMEOUT
        delete process.env.DB_CONNECTION_TIMEOUT

        const config = createDatabaseConfig()

        expect(config.max).toBe(20)
        expect(config.idleTimeoutMillis).toBe(10000)
        expect(config.connectionTimeoutMillis).toBe(5000)
      })

      it('should allow custom pool settings via environment variables', () => {
        process.env.DB_POOL_MAX = '15'
        process.env.DB_IDLE_TIMEOUT = '45000'
        process.env.DB_CONNECTION_TIMEOUT = '3000'

        const config = createDatabaseConfig()

        expect(config.max).toBe(15)
        expect(config.idleTimeoutMillis).toBe(45000)
        expect(config.connectionTimeoutMillis).toBe(3000)
      })

      it('should throw error for invalid pool numbers', () => {
        process.env.DB_POOL_MAX = 'invalid-number'

        expect(() => createDatabaseConfig()).toThrow('Failed to create database configuration')
        expect(getThrownCause(() => createDatabaseConfig()))
          .toContain('Environment variable DB_POOL_MAX must be a number, got: invalid-number')
      })
    })

    describe('SSL Configuration', () => {
      beforeEach(() => {
        process.env.DB_PASSWORD = 'required-password'
      })

      it('should disable SSL in non-production environments by default', () => {
        delete process.env.NODE_ENV
        delete process.env.DB_SSL

        const config = createDatabaseConfig()

        expect(config.ssl).toBe(false)
      })

      it('should enable SSL in production environment by default', () => {
        process.env.NODE_ENV = 'production'
        delete process.env.DB_SSL

        const config = createDatabaseConfig()

        expect(config.ssl).toEqual({ rejectUnauthorized: true })
      })

      it('should enable SSL with rejectUnauthorized: true when DB_SSL is true', () => {
        process.env.DB_SSL = 'true'

        const config = createDatabaseConfig()

        expect(config.ssl).toEqual({ rejectUnauthorized: true })
      })

      it('should disable SSL when DB_SSL is false', () => {
        process.env.NODE_ENV = 'production'
        process.env.DB_SSL = 'false'

        const config = createDatabaseConfig()

        expect(config.ssl).toBe(false)
      })

      it('should handle case-insensitive SSL boolean values', () => {
        process.env.DB_SSL = 'TRUE'

        const config = createDatabaseConfig()

        expect(config.ssl).toEqual({ rejectUnauthorized: true })
      })
    })

    describe('Complete Configuration', () => {
      it('should create complete configuration with all required fields', () => {
        process.env.DB_PASSWORD = 'test-password'
        process.env.DB_HOST = 'test-host'
        process.env.DB_PORT = '5433'
        process.env.DB_USER = 'test-user'
        process.env.DB_NAME = 'test_db'
        process.env.DB_POOL_MAX = '10'
        process.env.DB_IDLE_TIMEOUT = '20000'
        process.env.DB_CONNECTION_TIMEOUT = '1500'
        process.env.DB_SSL = 'true'

        const config = createDatabaseConfig()

        expect(config).toEqual({
          host: 'test-host',
          port: 5433,
          user: 'test-user',
          password: 'test-password',
          database: 'test_db',
          max: 10,
          idleTimeoutMillis: 20000,
          connectionTimeoutMillis: 1500,
          ssl: { rejectUnauthorized: true }
        })
      })
    })

    describe('Environment Variable Types', () => {
      beforeEach(() => {
        process.env.DB_PASSWORD = 'required-password'
      })

      it('should parse numeric environment variables correctly', () => {
        process.env.DB_PORT = '3306'
        process.env.DB_POOL_MAX = '25'

        const config = createDatabaseConfig()

        expect(typeof config.port).toBe('number')
        expect(typeof config.max).toBe('number')
        expect(config.port).toBe(3306)
        expect(config.max).toBe(25)
      })

      it('should parse boolean environment variables correctly', () => {
        process.env.DB_SSL = 'true'

        const config = createDatabaseConfig()

        expect(typeof config.ssl).toBe('object')
        expect(config.ssl).toEqual({ rejectUnauthorized: true })
      })
    })
  })
})

describe('database test seam', () => {
  it('returns an injected database instance', () => {
    const database = Object.create(null) as Parameters<typeof setDatabase>[0]
    setDatabase(database)
    expect(getDatabase()).toBe(database)
  })
})
