import type { SerializedError } from './logger.js'

/**
 * Logger 構造化対応のテスト。
 *
 * テスト設計 (/test-design 適用: 同値分割 + BVA + デシジョンテーブル + エラー推測)。
 * 純粋関数 (serializeError / buildJsonEntry / buildTextLine) を stdout キャプチャ無しに直接検証し、
 * orchestration (level フィルタ / format 選択 / child) は最小限の spy で検証する。
 *
 * | #    | 対象            | 入力 / 条件                                  | 期待結果                                            | 技法 |
 * |------|-----------------|----------------------------------------------|-----------------------------------------------------|------|
 * | T-1  | serializeError  | Error('boom') (stack あり)                   | {name,message,stack}、cause キーなし                | 同値 |
 * | T-2  | serializeError  | Error, cause=Error('inner')                  | cause={name,message} (stack/cause 含まない)         | エラー推測 |
 * | T-3  | serializeError  | Error, cause='str'                           | cause='str'                                         | 同値 |
 * | T-4  | serializeError  | Error, cause が更に cause を持つ             | cause は 1 段のみ (深い cause 含まれない)           | エラー推測 |
 * | T-5  | serializeError  | Error('') 空 message                         | message=''                                          | 境界 |
 * | T-6  | serializeError  | Error で stack 削除                          | stack キーなし                                      | 特異点 |
 * | T-7  | serializeError  | 'string error' (非 Error)                    | 'string error'                                      | 同値 |
 * | T-8  | serializeError  | 42                                           | '42'                                                | 同値 |
 * | T-9  | serializeError  | null                                         | 'null'                                              | 特異点 |
 * | T-10 | serializeError  | undefined                                    | 'undefined'                                         | 特異点 |
 * | T-11 | serializeError  | {} (plain object)                            | '{}' (JSON 文字列)                                  | 特異点 |
 * | T-12 | buildJsonEntry  | meta undefined                               | base フィールドのみ (traceId なし)                  | 境界 |
 * | T-13 | buildJsonEntry  | meta {}                                      | base フィールドのみ                                 | 境界 |
 * | T-14 | buildJsonEntry  | {userId:'u1', count:3}                       | base + userId + count                               | 同値 |
 * | T-15 | buildJsonEntry  | {error: Error('boom')}                       | base + error:{name,message,stack}                   | 同値 |
 * | T-16 | buildJsonEntry  | 予約キー衝突 meta                            | base 値保持、meta 予約キー無視                      | エラー推測 |
 * | T-17 | buildJsonEntry  | {payload:{a:1}} 非スカラ                     | payload:{a:1} (object 保持)                         | 同値 |
 * | T-18 | buildJsonEntry  | base.traceId='tid'                           | entry.traceId='tid'                                 | 境界 |
 * | T-19 | buildTextLine   | meta undefined, traceId なし                 | 'T [ERROR] msg'                                     | 境界 |
 * | T-20 | buildTextLine   | meta undefined, traceId 'tid'                | 'T [ERROR] [tid] msg'                               | 同値 |
 * | T-21 | buildTextLine   | {count:3}                                    | 'T [ERROR] msg count=3'                             | 同値 |
 * | T-22 | buildTextLine   | {payload:{a:1}}                              | 'T [ERROR] msg payload={"a":1}'                     | 同値 |
 * | T-23 | buildTextLine   | {error: Error('boom') stack='STK'}           | 'T [ERROR] msg error=Error: boom\nSTK'              | 同値 |
 * | T-23b| buildTextLine   | {error: Error('boom', cause Error('inner'))} | 'T [ERROR] msg error=Error: boom cause=Error: inner\nSTK' | 同値 |
 * | T-24 | buildTextLine   | {error: 'strerr'}                            | 'T [ERROR] msg error=strerr'                        | 同値 |
 * | T-25 | buildTextLine   | 予約キー衝突                                 | base 値保持                                         | エラー推測 |
 * | T-26 | level filter    | level ERROR(0), error()                      | 出力される                                          | BVA |
 * | T-27 | level filter    | level ERROR(0), warn()                       | 出力されない                                        | BVA |
 * | T-28 | level filter    | level WARN(1), warn()                        | 出力される                                          | BVA |
 * | T-29 | level filter    | level WARN(1), info()                        | 出力されない                                        | BVA |
 * | T-30 | level filter    | level INFO(2), info()                        | 出力される                                          | BVA |
 * | T-31 | level filter    | level INFO(2), debug()                       | 出力されない                                        | BVA |
 * | T-32 | level filter    | level DEBUG(3), debug()                      | 出力される                                          | BVA |
 * | T-33 | format json     | format json, error('m',{error})             | stdout に JSON、level=ERROR + error.stack 含む      | DT/結合 |
 * | T-34 | format text     | format text, error('m')                      | console.error が呼ばれる                            | DT |
 * | T-34b| format text     | format text, warn('m')                       | console.warn が呼ばれる                             | DT |
 * | T-35 | format text     | format text, info('m')                       | console.log が呼ばれる                              | DT |
 * | T-36 | child           | child({traceId}).error('m',{error}) (json)   | traceId 伝播、service/level/format 継承             | 結合 |
 * | T-37 | withTrace       | withTrace('tid') / withTrace(undefined)      | 前者は traceId 付き child、後者は self を返す       | DT/境界 |
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildJsonEntry, buildTextLine, createLogger, detectFormat, LogLevel, resolveLogLevel, serializeError } from './logger.js'

const BASE = { timestamp: 'T', level: 'ERROR', service: 'svc', message: 'msg' } as const

describe('serializeError', () => {
  it('Error を渡すと name/message/stack を返し cause キーを持たない', () => {
    const result = serializeError(new Error('boom'))
    expect(result).toMatchObject({ name: 'Error', message: 'boom' })
    expect((result as SerializedError).stack).toContain('boom')
    expect((result as SerializedError).cause).toBeUndefined()
  })

  it('cause が Error のとき cause を {name,message} に 1 段展開する', () => {
    const err = new Error('outer', { cause: new Error('inner') })
    const result = serializeError(err) as SerializedError
    expect(result.cause).toEqual({ name: 'Error', message: 'inner' })
  })

  it('cause が文字列のとき cause を String 化する', () => {
    const err = new Error('outer', { cause: 'str-cause' })
    const result = serializeError(err) as SerializedError
    expect(result.cause).toBe('str-cause')
  })

  it('cause がさらに cause を持つとき 1 段のみ展開し深い cause を含めない', () => {
    const deep = new Error('deep')
    const mid = new Error('mid', { cause: deep })
    const err = new Error('outer', { cause: mid })
    const result = serializeError(err) as SerializedError
    expect(result.cause).toEqual({ name: 'Error', message: 'mid' })
  })

  it('空 message の Error のとき message として空文字を返す', () => {
    const result = serializeError(new Error('')) as SerializedError
    expect(result.message).toBe('')
  })

  it('stack が無い Error のとき stack キーを持たない', () => {
    const err = new Error('no-stack')
    delete err.stack
    const result = serializeError(err) as SerializedError
    expect(result.stack).toBeUndefined()
  })

  it('文字列 (非 Error) を渡すとその文字列を返す', () => {
    expect(serializeError('string error')).toBe('string error')
  })

  it('数値を渡すと String 化する', () => {
    expect(serializeError(42)).toBe('42')
  })

  it('null を渡すと "null" を返す', () => {
    expect(serializeError(null)).toBe('null')
  })

  it('undefined を渡すと "undefined" を返す', () => {
    expect(serializeError(undefined)).toBe('undefined')
  })

  it('plain object を渡すと JSON 文字列を返す', () => {
    expect(serializeError({})).toBe('{}')
  })

  it('循環参照を含む cause でも throw せずフォールバック文字列を返す', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const err = new Error('outer', { cause: circular })
    expect(() => serializeError(err)).not.toThrow()
    expect((serializeError(err) as SerializedError).cause).toBe('[object Object]')
  })
})

describe('buildJsonEntry', () => {
  it('meta が undefined のとき base フィールドのみで traceId を含まない', () => {
    const entry = buildJsonEntry(BASE)
    expect(entry).toEqual({ timestamp: 'T', level: 'ERROR', service: 'svc', message: 'msg' })
  })

  it('meta が空のとき base フィールドのみを返す', () => {
    const entry = buildJsonEntry(BASE, {})
    expect(entry).toEqual({ timestamp: 'T', level: 'ERROR', service: 'svc', message: 'msg' })
  })

  it('スカラ meta をトップレベルフィールドとして展開する', () => {
    const entry = buildJsonEntry(BASE, { userId: 'u1', count: 3 })
    expect(entry).toMatchObject({ userId: 'u1', count: 3, message: 'msg' })
  })

  it('meta.error を serialize して error フィールドに入れる', () => {
    const entry = buildJsonEntry(BASE, { error: new Error('boom') })
    expect(entry.error).toMatchObject({ name: 'Error', message: 'boom' })
  })

  it('予約キーが meta にあっても base の値を優先し meta 側を無視する', () => {
    const entry = buildJsonEntry(BASE, {
      message: 'hack', level: 'X', service: 'evil', timestamp: 'bad', traceId: 'spoof',
    })
    expect(entry).toEqual({ timestamp: 'T', level: 'ERROR', service: 'svc', message: 'msg' })
  })

  it('非スカラ meta を object のまま保持する', () => {
    const entry = buildJsonEntry(BASE, { payload: { a: 1 } })
    expect(entry.payload).toEqual({ a: 1 })
  })

  it('base に traceId があるとき entry に traceId を含める', () => {
    const entry = buildJsonEntry({ ...BASE, traceId: 'tid' })
    expect(entry.traceId).toBe('tid')
  })
})

describe('buildTextLine', () => {
  it('meta undefined / traceId なしのとき従来形式の 1 行を返す', () => {
    expect(buildTextLine(BASE)).toBe('T [ERROR] msg')
  })

  it('traceId があるとき [traceId] を含める', () => {
    expect(buildTextLine({ ...BASE, traceId: 'tid' })).toBe('T [ERROR] [tid] msg')
  })

  it('スカラ meta を key=value で付加する', () => {
    expect(buildTextLine(BASE, { count: 3 })).toBe('T [ERROR] msg count=3')
  })

  it('非スカラ meta を key=JSON で付加する', () => {
    expect(buildTextLine(BASE, { payload: { a: 1 } })).toBe('T [ERROR] msg payload={"a":1}')
  })

  it('error meta のとき message を inline、stack を改行で付加する', () => {
    const err = new Error('boom')
    err.stack = 'STK'
    expect(buildTextLine(BASE, { error: err })).toBe('T [ERROR] msg error=Error: boom\nSTK')
  })

  it('error meta が非 Error のとき error=value で付加する', () => {
    expect(buildTextLine(BASE, { error: 'strerr' })).toBe('T [ERROR] msg error=strerr')
  })

  it('error meta に cause があるとき cause も inline で付加する', () => {
    const err = new Error('boom', { cause: new Error('inner') })
    err.stack = 'STK'
    expect(buildTextLine(BASE, { error: err })).toBe('T [ERROR] msg error=Error: boom cause=Error: inner\nSTK')
  })

  it('予約キー衝突のとき base 値を保持し meta 予約キーを無視する', () => {
    expect(buildTextLine(BASE, { message: 'hack', level: 'X' })).toBe('T [ERROR] msg')
  })
})

describe('Logger level フィルタ', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('level ERROR のとき error() は出力される', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    createLogger({ service: 'svc', level: LogLevel.ERROR, format: 'json' }).error('m')
    expect(spy).toHaveBeenCalledOnce()
  })

  it('level ERROR のとき warn() は出力されない', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    createLogger({ service: 'svc', level: LogLevel.ERROR, format: 'json' }).warn('m')
    expect(spy).not.toHaveBeenCalled()
  })

  it('level WARN のとき warn() は出力される', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    createLogger({ service: 'svc', level: LogLevel.WARN, format: 'json' }).warn('m')
    expect(spy).toHaveBeenCalledOnce()
  })

  it('level WARN のとき info() は出力されない', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    createLogger({ service: 'svc', level: LogLevel.WARN, format: 'json' }).info('m')
    expect(spy).not.toHaveBeenCalled()
  })

  it('level INFO のとき info() は出力される', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    createLogger({ service: 'svc', level: LogLevel.INFO, format: 'json' }).info('m')
    expect(spy).toHaveBeenCalledOnce()
  })

  it('level INFO のとき debug() は出力されない', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    createLogger({ service: 'svc', level: LogLevel.INFO, format: 'json' }).debug('m')
    expect(spy).not.toHaveBeenCalled()
  })

  it('level DEBUG のとき debug() は出力される', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    createLogger({ service: 'svc', level: LogLevel.DEBUG, format: 'json' }).debug('m')
    expect(spy).toHaveBeenCalledOnce()
  })

  it('level SILENT のとき error() すら出力されない (ERROR 未満で全抑止)', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const logger = createLogger({ service: 'svc', level: LogLevel.SILENT, format: 'text' })
    logger.error('m', { error: new Error('boom') })
    logger.warn('m')
    logger.info('m')
    logger.debug('m')
    expect(stdout).not.toHaveBeenCalled()
    expect(consoleErr).not.toHaveBeenCalled()
  })
})

describe('Logger format 選択 + child', () => {
  afterEach(() => vi.restoreAllMocks())

  it('format json のとき stdout に JSON を書き error.stack を含む', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    createLogger({ service: 'svc', level: LogLevel.DEBUG, format: 'json' }).error('m', { error: new Error('boom') })
    const written = spy.mock.calls[0]?.[0] as string
    const parsed = JSON.parse(written.trimEnd()) as Record<string, unknown>
    expect(parsed).toMatchObject({ level: 'ERROR', service: 'svc', message: 'm' })
    expect((parsed.error as SerializedError).stack).toContain('boom')
  })

  it('format text のとき error() は console.error に書く', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    createLogger({ service: 'svc', level: LogLevel.DEBUG, format: 'text' }).error('m')
    expect(spy).toHaveBeenCalledOnce()
  })

  it('format text のとき warn() は console.warn に書く', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    createLogger({ service: 'svc', level: LogLevel.DEBUG, format: 'text' }).warn('m')
    expect(spy).toHaveBeenCalledOnce()
  })

  it('format text のとき info() は console.log に書く', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    createLogger({ service: 'svc', level: LogLevel.DEBUG, format: 'text' }).info('m')
    expect(spy).toHaveBeenCalledOnce()
  })

  it('child({traceId}) は traceId を伝播し service/level/format を継承する', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const base = createLogger({ service: 'svc', level: LogLevel.DEBUG, format: 'json' })
    base.child({ traceId: 'tid' }).error('m', { error: new Error('boom') })
    const written = spy.mock.calls[0]?.[0] as string
    const parsed = JSON.parse(written.trimEnd()) as Record<string, unknown>
    expect(parsed.traceId).toBe('tid')
    expect(parsed.service).toBe('svc')
  })

  it('withTrace(traceId) は traceId 付き child を返し、withTrace(undefined) は self を返す', () => {
    const base = createLogger({ service: 'svc', level: LogLevel.DEBUG, format: 'json' })
    expect(base.withTrace(undefined)).toBe(base)

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    base.withTrace('tid').error('m')
    const written = spy.mock.calls[0]?.[0] as string
    expect((JSON.parse(written.trimEnd()) as Record<string, unknown>).traceId).toBe('tid')
  })
})

describe('resolveLogLevel', () => {
  it('ERROR を解決する', () => { expect(resolveLogLevel('ERROR')).toBe(LogLevel.ERROR) })
  it('小文字 warn も大文字化して解決する', () => { expect(resolveLogLevel('warn')).toBe(LogLevel.WARN) })
  it('INFO を解決する', () => { expect(resolveLogLevel('INFO')).toBe(LogLevel.INFO) })
  it('DEBUG を解決する', () => { expect(resolveLogLevel('DEBUG')).toBe(LogLevel.DEBUG) })
  it('undefined のとき INFO を返す', () => { expect(resolveLogLevel(undefined)).toBe(LogLevel.INFO) })
  it('不正値のとき INFO を返す', () => { expect(resolveLogLevel('garbage')).toBe(LogLevel.INFO) })
  it('SILENT を解決する', () => { expect(resolveLogLevel('SILENT')).toBe(LogLevel.SILENT) })
  it('小文字 silent / none / off も SILENT に解決する', () => {
    expect(resolveLogLevel('silent')).toBe(LogLevel.SILENT)
    expect(resolveLogLevel('none')).toBe(LogLevel.SILENT)
    expect(resolveLogLevel('off')).toBe(LogLevel.SILENT)
  })
})

describe('detectFormat', () => {
  it('明示 json は json', () => { expect(detectFormat('json', false)).toBe('json') })
  it('明示 text は Lambda でも text', () => { expect(detectFormat('text', true)).toBe('text') })
  it('未指定かつ Lambda は json', () => { expect(detectFormat(undefined, true)).toBe('json') })
  it('未指定かつ非 Lambda は text', () => { expect(detectFormat(undefined, false)).toBe('text') })
})
