import { describe, expect, it } from 'vitest'

import { sanitizeString, sanitizeTemplate, synthStacks } from './template-snapshot.js'

// テスト技法の適用方針:
// sanitizeString: デシジョンテーブル + BVA(hex 長 63/64/65) /
// sanitizeTemplate: 再帰(値・キー・配列・primitive) + 冪等性 property /
// 決定性: 2 回 synth の正規化結果一致(UUID/asset hash 除去の網羅検証) / snapshot: golden master。

const HASH64 = 'a'.repeat(64)
const UUID = '1b4e28ba-2fa1-11d2-883f-0016d3cca427'

describe('sanitizeString', () => {
  it('64 桁 hex を [ASSET-HASH] に置換する', () => {
    expect(sanitizeString(`AssetParameters${HASH64}S3Bucket`)).toBe('AssetParameters[ASSET-HASH]S3Bucket')
  })

  it('UUID を [UUID] に置換する', () => {
    expect(sanitizeString(`webapp-prod-${UUID}`)).toBe('webapp-prod-[UUID]')
  })

  it('hex と UUID が混在しても両方置換する', () => {
    expect(sanitizeString(`${HASH64}/${UUID}`)).toBe('[ASSET-HASH]/[UUID]')
  })

  it('63 桁 hex(境界)は置換しない', () => {
    const hex63 = 'a'.repeat(63)
    expect(sanitizeString(hex63)).toBe(hex63)
  })

  it('65 桁 hex は残骸なく全置換する', () => {
    expect(sanitizeString('a'.repeat(65))).toBe('[ASSET-HASH]')
  })

  it('13 桁の epoch-ms タイムスタンプを [TIMESTAMP] に置換する(migration トリガ由来)', () => {
    expect(sanitizeString('{"id":"1781618368563"}')).toBe('{"id":"[TIMESTAMP]"}')
  })

  it('12 桁(account id 相当)は置換しない(境界)', () => {
    expect(sanitizeString('123456789012')).toBe('123456789012')
  })

  it('先頭桁が繰り上がった将来の epoch-ms(13 桁・先頭 2)も置換する', () => {
    expect(sanitizeString('2781618368563')).toBe('[TIMESTAMP]')
  })

  it('hex/UUID を含まない文字列は不変', () => {
    expect(sanitizeString('BackendLambdaServiceRole')).toBe('BackendLambdaServiceRole')
  })

  it('空文字は不変', () => {
    expect(sanitizeString('')).toBe('')
  })
})

describe('sanitizeTemplate', () => {
  it('ネストした値の hash を置換する', () => {
    expect(sanitizeTemplate({ Resources: { Key: `${HASH64}.zip` } })).toEqual({
      Resources: { Key: '[ASSET-HASH].zip' },
    })
  })

  it('オブジェクトのキーに含まれる hash を置換する', () => {
    const out = sanitizeTemplate({ [`AssetParameters${HASH64}Ref`]: 1 }) as Record<string, unknown>
    expect(Object.keys(out)).toEqual(['AssetParameters[ASSET-HASH]Ref'])
  })

  it('配列の各要素を置換する', () => {
    expect(sanitizeTemplate([HASH64, UUID, 'plain'])).toEqual(['[ASSET-HASH]', '[UUID]', 'plain'])
  })

  it('number / boolean / null は不変', () => {
    expect(sanitizeTemplate({ a: 1, b: true, c: null })).toEqual({ a: 1, b: true, c: null })
  })

  it('冪等である(sanitize を 2 回適用しても結果が同じ)', () => {
    const once = sanitizeTemplate({ k: `${HASH64}-${UUID}` })
    expect(sanitizeTemplate(once)).toEqual(once)
  })
})

describe('CDK template snapshot', () => {
  it('StatefulStack は 2 回 synth しても正規化後テンプレートが一致する(決定性)', () => {
    const a = sanitizeTemplate(synthStacks().stateful)
    const b = sanitizeTemplate(synthStacks().stateful)
    expect(a).toEqual(b)
  })

  it('AppStack は 2 回 synth しても正規化後テンプレートが一致する(UUID/asset hash 除去の検証)', () => {
    const a = sanitizeTemplate(synthStacks().app)
    const b = sanitizeTemplate(synthStacks().app)
    expect(a).toEqual(b)
  })

  it('StatefulStack の正規化済テンプレートが snapshot と一致する', () => {
    expect(sanitizeTemplate(synthStacks().stateful)).toMatchSnapshot()
  })

  it('AppStack の正規化済テンプレートが snapshot と一致する', () => {
    expect(sanitizeTemplate(synthStacks().app)).toMatchSnapshot()
  })
})
