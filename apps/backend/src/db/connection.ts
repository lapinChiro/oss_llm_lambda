import type { DB } from './generated-types.js'

import fs from 'fs'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool, types } from 'pg'

import {
  getRequiredEnv,
  getOptionalEnv,
  getNumberEnv,
  getBooleanEnv
} from '../utils/env.js'

// DATE 列を string で返す (pg-node の default は local TZ で Date 化するためその往復を抑止)
// グローバル設定のためモジュールトップレベルで Pool 構築前に評価される必要あり
types.setTypeParser(types.builtins.DATE, (val) => val)

/**
 * データベース接続設定インターフェース
 */
export interface DatabaseConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  max: number
  idleTimeoutMillis: number
  connectionTimeoutMillis: number
  ssl: boolean | { rejectUnauthorized: boolean; ca?: string }
}

class DatabaseConfigError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'DatabaseConfigError'
  }
}

/** RDS CA バンドルのパス（Docker イメージに同梱） */
const RDS_CA_BUNDLE_PATH = '/opt/rds-ca/global-bundle.pem'

/**
 * RDS CA バンドルを読み込む（存在する場合のみ）
 */
let _cachedCa: string | undefined
function getRdsCaBundle(): string | undefined {
  if (_cachedCa !== undefined) return _cachedCa || undefined
  try {
    _cachedCa = fs.readFileSync(RDS_CA_BUNDLE_PATH, 'utf-8')
    return _cachedCa
  } catch {
    _cachedCa = ''
    return undefined
  }
}

/**
 * データベース設定の妥当性をチェックする
 * @param config - 検証するデータベース設定
 * @throws {DatabaseConfigError} 設定値が不正な場合
 */
function validateDatabaseConfig(config: DatabaseConfig): void {
  if (!config.host.trim()) {
    throw new DatabaseConfigError('Database host cannot be empty')
  }

  if (config.port < 1 || config.port > 65535) {
    throw new DatabaseConfigError(`Invalid database port: ${config.port}. Must be between 1 and 65535`)
  }

  if (!config.user.trim()) {
    throw new DatabaseConfigError('Database user cannot be empty')
  }

  if (!config.password.trim()) {
    throw new DatabaseConfigError('Database password cannot be empty')
  }

  if (!config.database.trim()) {
    throw new DatabaseConfigError('Database name cannot be empty')
  }

  if (config.max < 1) {
    throw new DatabaseConfigError(`Invalid max connections: ${config.max}. Must be greater than 0`)
  }

  if (config.idleTimeoutMillis < 0) {
    throw new DatabaseConfigError(`Invalid idle timeout: ${config.idleTimeoutMillis}. Must be non-negative`)
  }

  if (config.connectionTimeoutMillis < 0) {
    throw new DatabaseConfigError(`Invalid connection timeout: ${config.connectionTimeoutMillis}. Must be non-negative`)
  }
}

/**
 * データベース接続設定を生成する（同期版 - ローカル開発用）
 * @returns 型安全なデータベース設定オブジェクト
 * @throws {DatabaseConfigError} 必須の環境変数が不足している場合
 */
export function createDatabaseConfig(dbPassword?: string): DatabaseConfig {
  const isProduction = process.env.NODE_ENV === 'production'

  try {
    const config: DatabaseConfig = {
      host: getOptionalEnv('DB_HOST', 'localhost'),
      port: getNumberEnv('DB_PORT', 5432),
      user: getOptionalEnv('DB_USER', 'postgres'),
      password: dbPassword ?? getRequiredEnv('DB_PASSWORD'),
      database: getOptionalEnv('DB_NAME', 'app_dev'),

      // 接続プール設定
      max: getNumberEnv('DB_POOL_MAX', isProduction ? 20 : 5),
      idleTimeoutMillis: getNumberEnv('DB_IDLE_TIMEOUT', isProduction ? 10000 : 30000),
      connectionTimeoutMillis: getNumberEnv('DB_CONNECTION_TIMEOUT', isProduction ? 5000 : 2000),

      // SSL設定（RDS CA バンドルがあれば証明書検証、なければ暗号化のみ）
      ssl: getBooleanEnv('DB_SSL', isProduction)
        ? { rejectUnauthorized: true, ca: getRdsCaBundle() }
        : false
    }

    validateDatabaseConfig(config)

    return config
  } catch (error) {
    throw new DatabaseConfigError('Failed to create database configuration', { cause: error })
  }
}

let _db: Kysely<DB> | null = null

/**
 * データベース接続を非同期で初期化する
 *
 * Lambda ハンドラーまたは Node.js サーバーの起動時に1回呼び出す。
 * 2回目以降の呼び出しは何もしない（冪等）。
 */
export function initDatabase(): void {
  if (_db) return

  const poolConfig = createDatabaseConfig()

  const dialect = new PostgresDialect({
    pool: new Pool(poolConfig),
  })
  _db = new Kysely<DB>({ dialect })
}

/**
 * テスト用: 外部からデータベースインスタンスを注入する。
 * PGliteなどの代替ダイアレクトを使用するテストで利用する。
 *
 * @param db - 注入するKyselyインスタンス
 */
export function setDatabase(db: Kysely<DB>): void {
  _db = db
}

/**
 * データベースインスタンスを取得する（遅延初期化）
 *
 * 注意: Lambda 環境では事前に initDatabase() を呼び出しておく必要がある。
 * ローカル環境では従来通り初回呼び出し時に自動初期化する。
 */
export function getDatabase(): Kysely<DB> {
  if (!_db) {
    const poolConfig = createDatabaseConfig()
    const dialect = new PostgresDialect({
      pool: new Pool(poolConfig)
    })
    _db = new Kysely<DB>({ dialect })
  }
  return _db
}
