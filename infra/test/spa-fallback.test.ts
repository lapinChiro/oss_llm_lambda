import { describe, expect, it } from 'vitest'

import { resolveSpaFallbackUri } from '../lib/cloudfront/spa-fallback.js'

// テスト技法の適用方針:
// resolveSpaFallbackUri: 同値分割 (拡張子あり/なし) + 境界値分析 (拡張子長 0/1 文字・多段拡張子・
//   ドット位置・文字クラス境界) + エラー推測 (dotfile・大文字拡張子) + i18n (非 ASCII パス)。
// fast-check (property-based) は不使用: infra workspace に fast-check は未導入で、対象は
//   正規表現 1 本の単一分岐のみのため、下表の BVA で同値クラスを尽くせる (1 関数のために依存を
//   足すのは過剰)。
// querystring 付き URI はテストしない: CloudFront Function の `request.uri` はパス部分のみを
//   保持し querystring は `request.querystring` に分離される契約のため到達不能。テストすると
//   `/about?v=1.2` を拡張子ありと誤判定する無意味な挙動を pin することになる。
//
// | # | カテゴリ | 入力 uri | 期待結果 | 技法 |
// |---|---|---|---|---|
// | S-1 | 正常系 | /assets/app.js | /assets/app.js (素通し) | 同値分割 |
// | S-2 | 正常系 | /about | /index.html | 同値分割 |
// | S-3 | 境界値 | / | /index.html | BVA (最小) |
// | S-4 | 境界値 | '' (空文字) | /index.html | BVA (特異点) |
// | S-5 | 境界値 | /file. (末尾ドット) | /index.html | BVA (拡張子0文字 = min-ε) |
// | S-6 | 境界値 | /a.j (1文字拡張子) | /a.j (素通し) | BVA (拡張子1文字 = min) |
// | S-7 | 境界値 | /archive.tar.gz (多段拡張子) | /archive.tar.gz (素通し) | BVA |
// | S-8 | 境界値 | /v1.2/about (ドットが末尾でない) | /index.html | BVA ($ アンカー) |
// | S-9 | 境界値 | /.hidden (dotfile) | /.hidden (素通し) | エラー推測 |
// | S-10 | 境界値 | /file.JS (大文字拡張子) | /file.JS (素通し) | BVA (文字クラス上端) |
// | S-11 | 境界値 | /file.tar-gz (英数字以外を含む) | /index.html | BVA (文字クラス外) |
// | S-12 | i18n | /概要 (非ASCII・拡張子なし) | /index.html | エラー推測 (i18n) |
//
// 期待結果は inline (app-stack.ts) の現挙動の characterization であり、実装を読んで導出済み
// (実行結果を見てから決めたものではない)。S-9 / S-10 は「現挙動をそのまま記録する」ことが目的。

describe('resolveSpaFallbackUri', () => {
  it('S-1: 拡張子付きパスはそのまま (素通し)', () => {
    expect(resolveSpaFallbackUri('/assets/app.js')).toBe('/assets/app.js')
  })

  it('S-2: 拡張子なしパスは /index.html へ書換える', () => {
    expect(resolveSpaFallbackUri('/about')).toBe('/index.html')
  })

  it('S-3: ルートパス "/" は /index.html へ書換える', () => {
    expect(resolveSpaFallbackUri('/')).toBe('/index.html')
  })

  it('S-4: 空文字は /index.html へ書換える', () => {
    expect(resolveSpaFallbackUri('')).toBe('/index.html')
  })

  it('S-5: 末尾ドット (拡張子0文字) は /index.html へ書換える', () => {
    expect(resolveSpaFallbackUri('/file.')).toBe('/index.html')
  })

  it('S-6: 1文字拡張子はそのまま (素通し)', () => {
    expect(resolveSpaFallbackUri('/a.j')).toBe('/a.j')
  })

  it('S-7: 多段拡張子 (.tar.gz) はそのまま (素通し)', () => {
    expect(resolveSpaFallbackUri('/archive.tar.gz')).toBe('/archive.tar.gz')
  })

  it('S-8: ドットが末尾でないパスは /index.html へ書換える', () => {
    expect(resolveSpaFallbackUri('/v1.2/about')).toBe('/index.html')
  })

  it('S-9: dotfile (先頭ドット・拡張子なし) はそのまま (素通し)', () => {
    expect(resolveSpaFallbackUri('/.hidden')).toBe('/.hidden')
  })

  it('S-10: 大文字拡張子はそのまま (素通し)', () => {
    expect(resolveSpaFallbackUri('/file.JS')).toBe('/file.JS')
  })

  it('S-11: 拡張子部分に英数字以外を含む場合は /index.html へ書換える', () => {
    expect(resolveSpaFallbackUri('/file.tar-gz')).toBe('/index.html')
  })

  it('S-12: 非 ASCII パス (拡張子なし) は /index.html へ書換える', () => {
    expect(resolveSpaFallbackUri('/概要')).toBe('/index.html')
  })
})
