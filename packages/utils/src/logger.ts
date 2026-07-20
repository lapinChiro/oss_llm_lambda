export const LogLevel = {
  /** 全レベル抑止 (ERROR より下)。テスト環境で期待エラーのログノイズを消す用途。 */
  SILENT: -1,
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]

export type LogFormat = 'json' | 'text'

export interface LoggerOptions {
  service: string
  level?: LogLevel
  traceId?: string
  format?: LogFormat
}

/**
 * 構造化ログのメタ情報。`error` は例外オブジェクト用の予約フィールドで、
 * Error なら name/message/stack/cause (1 段) を抽出して出力する。
 * その他の任意キーは構造化フィールドとして出力される。
 */
export interface LogMeta {
  error?: unknown
  [key: string]: unknown
}

export interface SerializedError {
  name: string
  message: string
  stack?: string
  cause?: { name: string; message: string } | string
}

interface LogBase {
  timestamp: string
  level: string
  service: string
  traceId?: string
  message: string
}

/** ログエントリの予約キー。meta が同名キーを持っても Logger 側の値を優先する。 */
const RESERVED_KEYS: ReadonlySet<string> = new Set([
  'timestamp', 'level', 'service', 'traceId', 'message',
])

/**
 * 任意の値を文字列化する (純粋関数)。logger が throw しないよう循環参照もガードする。
 * 文字列はそのまま、object は JSON、その他プリミティブは String で表現する。
 */
function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || value === null) return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

/**
 * 例外値を構造化形式に正規化する (純粋関数)。
 * Error なら name/message/stack と cause を 1 段だけ展開し、Error 以外は文字列化する。
 */
export function serializeError(err: unknown): SerializedError | string {
  if (!(err instanceof Error)) {
    return safeStringify(err)
  }
  const out: SerializedError = { name: err.name, message: err.message }
  if (err.stack !== undefined) {
    out.stack = err.stack
  }
  if (err.cause !== undefined) {
    out.cause = err.cause instanceof Error
      ? { name: err.cause.name, message: err.cause.message }
      : safeStringify(err.cause)
  }
  return out
}

/**
 * meta を構造化フィールドに変換する (純粋関数)。
 * `error` は serialize し、予約キーは除外する (Logger 側の値を壊さないため)。
 */
function buildLogFields(meta?: LogMeta): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  if (meta === undefined) {
    return fields
  }
  for (const [key, value] of Object.entries(meta)) {
    if (RESERVED_KEYS.has(key)) {
      continue
    }
    fields[key] = key === 'error' ? serializeError(value) : value
  }
  return fields
}

/**
 * JSON ログエントリを組み立てる (純粋関数)。base の予約フィールドが常に優先される。
 */
export function buildJsonEntry(base: LogBase, meta?: LogMeta): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    timestamp: base.timestamp,
    level: base.level,
    service: base.service,
  }
  if (base.traceId !== undefined) {
    entry.traceId = base.traceId
  }
  entry.message = base.message
  return { ...entry, ...buildLogFields(meta) }
}

/**
 * text ログ 1 行を組み立てる (純粋関数)。meta は key=value (非スカラ/循環は safeStringify)、
 * error は message を inline + stack を改行で付加する。
 */
export function buildTextLine(base: LogBase, meta?: LogMeta): string {
  const traceStr = base.traceId !== undefined ? ` [${base.traceId}]` : ''
  let line = `${base.timestamp} [${base.level}]${traceStr} ${base.message}`
  let stack: string | undefined

  for (const [key, value] of Object.entries(buildLogFields(meta))) {
    if (key === 'error') {
      if (typeof value === 'object' && value !== null) {
        const serialized = value as SerializedError
        line += ` error=${serialized.name}: ${serialized.message}`
        if (serialized.cause !== undefined) {
          line += typeof serialized.cause === 'object'
            ? ` cause=${serialized.cause.name}: ${serialized.cause.message}`
            : ` cause=${serialized.cause}`
        }
        stack = serialized.stack
      } else {
        line += ` error=${safeStringify(value)}`
      }
      continue
    }
    line += ` ${key}=${safeStringify(value)}`
  }

  if (stack !== undefined) {
    line += `\n${stack}`
  }
  return line
}

/** LOG_LEVEL 環境変数値から LogLevel を解決する (純粋関数)。未指定/不正は INFO。'silent'/'none'/'off' は全抑止。 */
export function resolveLogLevel(raw: string | undefined): LogLevel {
  const level = raw?.toUpperCase()
  if (level === 'SILENT' || level === 'NONE' || level === 'OFF') return LogLevel.SILENT
  if (level === 'ERROR') return LogLevel.ERROR
  if (level === 'WARN') return LogLevel.WARN
  if (level === 'INFO') return LogLevel.INFO
  if (level === 'DEBUG') return LogLevel.DEBUG
  return LogLevel.INFO
}

/** 出力形式を判定する (純粋関数)。明示指定 > Lambda(json) > text。 */
export function detectFormat(logFormat: string | undefined, isLambda: boolean): LogFormat {
  if (logFormat === 'json') return 'json'
  if (logFormat === 'text') return 'text'
  return isLambda ? 'json' : 'text'
}

const globalFormat = detectFormat(process.env.LOG_FORMAT, Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME))
const globalLevel = resolveLogLevel(process.env.LOG_LEVEL)

export class Logger {
  private readonly service: string
  private readonly level: LogLevel
  private readonly format: LogFormat
  private readonly traceId?: string

  constructor(options: LoggerOptions) {
    this.service = options.service
    this.level = options.level ?? globalLevel
    this.format = options.format ?? globalFormat
    this.traceId = options.traceId
  }

  child(overrides: { traceId: string }): Logger {
    return new Logger({
      service: this.service,
      level: this.level,
      format: this.format,
      traceId: overrides.traceId,
    })
  }

  /**
   * traceId があれば trace スコープの子 logger を、なければ自身を返す。
   * 「optional な traceId からログ相関付き logger を得る」呼び出し側の定型分岐を集約する。
   */
  withTrace(traceId?: string): Logger {
    return traceId === undefined ? this : this.child({ traceId })
  }

  error(message: string, meta?: LogMeta): void {
    if (this.level >= LogLevel.ERROR) this.write('ERROR', message, meta)
  }

  warn(message: string, meta?: LogMeta): void {
    if (this.level >= LogLevel.WARN) this.write('WARN', message, meta)
  }

  info(message: string, meta?: LogMeta): void {
    if (this.level >= LogLevel.INFO) this.write('INFO', message, meta)
  }

  debug(message: string, meta?: LogMeta): void {
    if (this.level >= LogLevel.DEBUG) this.write('DEBUG', message, meta)
  }

  private write(level: string, message: string, meta?: LogMeta): void {
    const base: LogBase = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
    }
    if (this.traceId !== undefined) {
      base.traceId = this.traceId
    }

    if (this.format === 'json') {
      process.stdout.write(JSON.stringify(buildJsonEntry(base, meta)) + '\n')
    } else {
      this.writeText(level, buildTextLine(base, meta))
    }
  }

  private writeText(level: string, line: string): void {
    if (level === 'ERROR') {
      console.error(line)
    } else if (level === 'WARN') {
      console.warn(line)
    } else {
      console.log(line)
    }
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options)
}
