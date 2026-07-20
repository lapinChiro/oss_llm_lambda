import { PostgresEngineVersion } from 'aws-cdk-lib/aws-rds'
import { describe, expect, it } from 'vitest'

import {
  DEPLOYED_POSTGRES_MAJOR,
  DEFERRED_POSTGRES_UPGRADES,
  type DeferredUpgrade,
} from './postgres-version-currency.ledger.js'
import {
  extractMajors,
  findUnacknowledgedMajors,
  findLedgerProblems,
  formatDeferralWarnings,
} from './version-currency.js'

// テスト技法の適用方針:
// extractMajors: 同値分割 + BVA / findUnacknowledgedMajors: BVA + 集合 + off-by-one /
// findLedgerProblems: デシジョンテーブル + エラー推測 / live gate: シナリオ。

/** valid なエントリの素体（個別条件を 1 つずつ崩して DT を作る） */
const validEntry: DeferredUpgrade = {
  major: 18,
  acknowledgedAt: '2026-09-01',
  reason: 'RDS 18 GA 直後で実績が浅いため次マイナーまで様子見',
  reevaluateWhen: '2026-12 / VER_18 の .2 リリース後',
}

describe('extractMajors', () => {
  it('VER_<数字> のメジャーキーを番号として抽出する', () => {
    expect(extractMajors(['VER_17', 'VER_16'])).toEqual([17, 16])
  })

  it('マイナー入りキー(VER_17_4 等)は除外する', () => {
    expect(extractMajors(['VER_17', 'VER_17_4', 'VER_13_2'])).toEqual([17])
  })

  it('非 VER / 数字なしキーは除外する', () => {
    expect(extractMajors(['VER', 'latestOf', 'of', 'VER_'])).toEqual([])
  })

  it('境界(VER_0 / 多桁 VER_100)も抽出する', () => {
    expect(extractMajors(['VER_0', 'VER_100'])).toEqual([0, 100])
  })

  it('小文字 ver_17 は大文字小文字を区別して除外する', () => {
    expect(extractMajors(['ver_17'])).toEqual([])
  })

  it('空配列のとき空配列を返す', () => {
    expect(extractMajors([])).toEqual([])
  })
})

describe('findUnacknowledgedMajors', () => {
  it('デプロイ中以下のメジャーのみのとき空を返す(現状 green)', () => {
    expect(findUnacknowledgedMajors([17, 16, 15], 17, [])).toEqual([])
  })

  it('m<D / m==D は > 判定で除外する(off-by-one)', () => {
    expect(findUnacknowledgedMajors([16, 17], 17, [])).toEqual([])
  })

  it('デプロイ中+1 の未登録メジャーを検知する', () => {
    expect(findUnacknowledgedMajors([18, 17, 16], 17, [])).toEqual([18])
  })

  it('台帳に登録された新メジャーは除外する(green に戻る)', () => {
    expect(findUnacknowledgedMajors([18, 17], 17, [18])).toEqual([])
  })

  it('部分 ack のとき未登録の版だけ残す', () => {
    expect(findUnacknowledgedMajors([19, 18, 17], 17, [18])).toEqual([19])
  })

  it('デプロイ中を下げると間の版が unacknowledged として浮上する', () => {
    expect(findUnacknowledgedMajors([18, 17], 16, [])).toEqual([17, 18])
  })

  it('enum 重複は dedup して返す', () => {
    expect(findUnacknowledgedMajors([18, 18, 17], 17, [])).toEqual([18])
  })
})

describe('findLedgerProblems', () => {
  const enumMajors = [16, 17, 18, 19]
  const deployed = 17

  it('全項目 valid・major∈enum・>D のとき問題なし', () => {
    expect(findLedgerProblems([validEntry], enumMajors, deployed)).toEqual([])
  })

  it('reason が空白のみのとき問題を報告する', () => {
    const problems = findLedgerProblems([{ ...validEntry, reason: '   ' }], enumMajors, deployed)
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join('\n')).toMatch(/reason/i)
  })

  it('reevaluateWhen が空のとき問題を報告する', () => {
    const problems = findLedgerProblems([{ ...validEntry, reevaluateWhen: '' }], enumMajors, deployed)
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join('\n')).toMatch(/reevaluateWhen/i)
  })

  it('acknowledgedAt が YYYY-MM-DD でないとき問題を報告する', () => {
    const problems = findLedgerProblems([{ ...validEntry, acknowledgedAt: '2026-9-1' }], enumMajors, deployed)
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join('\n')).toMatch(/acknowledgedAt/i)
  })

  it('major が enum に実在しないとき問題を報告する(架空版の先回り禁止)', () => {
    const problems = findLedgerProblems([{ ...validEntry, major: 99 }], enumMajors, deployed)
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join('\n')).toMatch(/99/)
  })

  it('major がデプロイ中以下のとき stale として問題を報告する', () => {
    const problems = findLedgerProblems([{ ...validEntry, major: 17 }], enumMajors, deployed)
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join('\n')).toMatch(/stale|17/i)
  })

  it('major が重複するとき問題を報告する', () => {
    const problems = findLedgerProblems([validEntry, { ...validEntry }], enumMajors, deployed)
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join('\n')).toMatch(/duplicate|重複|18/i)
  })

  it('空台帳のとき問題なし', () => {
    expect(findLedgerProblems([], enumMajors, deployed)).toEqual([])
  })
})

describe('formatDeferralWarnings', () => {
  it('各エントリの major と日付・再評価条件を含む 1 行を返す', () => {
    const lines = formatDeferralWarnings([validEntry])
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('18')
    expect(lines[0]).toContain('2026-09-01')
    expect(lines[0]).toContain(validEntry.reevaluateWhen)
  })

  it('空台帳のとき空配列を返す', () => {
    expect(formatDeferralWarnings([])).toEqual([])
  })
})

describe('L3 live gate (実 PostgresEngineVersion + 実台帳)', () => {
  const realMajors = extractMajors(Object.keys(PostgresEngineVersion))

  it('実 enum に現行デプロイメジャーが存在する', () => {
    expect(realMajors).toContain(DEPLOYED_POSTGRES_MAJOR)
  })

  it('未検討の新メジャーが存在しない(台帳未登録の新版が出たら fail)', () => {
    const deferredMajors = DEFERRED_POSTGRES_UPGRADES.map((d) => d.major)
    const unacknowledged = findUnacknowledgedMajors(realMajors, DEPLOYED_POSTGRES_MAJOR, deferredMajors)
    expect(
      unacknowledged,
      `新しい PostgreSQL メジャー版が aws-cdk-lib に登場し、未検討です: ${unacknowledged.join(', ')}.\n` +
        '対応: (a) アップグレード = 実スタックの VER_ と ledger の DEPLOYED_POSTGRES_MAJOR を更新 / ' +
        '(b) 検討の上で見送る = DEFERRED_POSTGRES_UPGRADES に理由付きで追記し対応 TODO を起票。' +
        'テスト無効化・期待値の無言引き上げは禁止。',
    ).toEqual([])
  })

  it('見送り台帳に rot(不正・stale)が無い', () => {
    expect(findLedgerProblems(DEFERRED_POSTGRES_UPGRADES, realMajors, DEPLOYED_POSTGRES_MAJOR)).toEqual([])
  })

  it('有効な見送りがあれば CI ログに warn を出す(副作用・例外を投げない)', () => {
    const warnings = formatDeferralWarnings(DEFERRED_POSTGRES_UPGRADES)
    for (const line of warnings) {
      // eslint-disable-next-line no-console
      console.warn(line)
    }
    expect(warnings).toHaveLength(DEFERRED_POSTGRES_UPGRADES.length)
  })
})
