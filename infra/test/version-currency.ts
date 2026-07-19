/**
 * PostgreSQL エンジン版の currency 検知（L3）の純粋ロジック。
 *
 * 「固定中の enum より新しいメジャー版が aws-cdk-lib に登場した」事実を検知するための
 * 純粋関数群。実 enum / 実台帳への適用は test 側（live gate）で行い、本モジュールは
 * 副作用を持たない（テスト容易性のため stateless/pure に保つ）。
 */

/** バージョンアップを「検討の上で意図的に見送った」1 件分の記録。 */
export interface DeferredUpgrade {
  /** 見送り対象の新メジャー番号（例: 18）。aws-cdk-lib の enum に実在する版であること。 */
  major: number
  /** 見送りを決めた日（YYYY-MM-DD）。 */
  acknowledgedAt: string
  /** なぜ今上げないか（非空必須）。 */
  reason: string
  /** 再評価のトリガ条件（対応する TODO の再開条件と揃える。非空必須）。 */
  reevaluateWhen: string
}

const MAJOR_KEY = /^VER_\d+$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * `PostgresEngineVersion` 等の enum キー配列から、メジャー版番号のみを抽出する。
 * `VER_17` → 17。`VER_17_4`（マイナー入り）/ `latestOf` 等は除外する。
 */
export function extractMajors(enumKeys: string[]): number[] {
  return enumKeys.filter((k) => MAJOR_KEY.test(k)).map((k) => Number(k.slice('VER_'.length)))
}

/**
 * デプロイ中メジャーより新しく、かつ台帳（deployed + deferred）に未登録のメジャーを返す。
 * 昇順・重複排除。空ならば「未検討の新版は無い」＝ green。
 */
export function findUnacknowledgedMajors(
  enumMajors: number[],
  deployedMajor: number,
  deferredMajors: number[],
): number[] {
  const acknowledged = new Set<number>([deployedMajor, ...deferredMajors])
  const unacknowledged = new Set<number>()
  for (const major of enumMajors) {
    if (major > deployedMajor && !acknowledged.has(major)) {
      unacknowledged.add(major)
    }
  }
  return [...unacknowledged].sort((a, b) => a - b)
}

/**
 * 見送り台帳の rot（不正・stale）を検出する。空配列なら台帳は健全。
 * - reason / reevaluateWhen が非空
 * - acknowledgedAt が YYYY-MM-DD 形式
 * - major が enum に実在（架空版の先回り登録を禁止）
 * - major がデプロイ中超（デプロイ済み以下の残骸 = stale を禁止）
 * - major が重複しない
 */
export function findLedgerProblems(
  deferred: readonly DeferredUpgrade[],
  enumMajors: number[],
  deployedMajor: number,
): string[] {
  const problems: string[] = []
  const enumSet = new Set(enumMajors)
  const seen = new Set<number>()
  for (const entry of deferred) {
    const label = `PostgreSQL ${entry.major}`
    if (entry.reason.trim() === '') {
      problems.push(`${label}: reason が空です（なぜ今上げないかを記載してください）`)
    }
    if (entry.reevaluateWhen.trim() === '') {
      problems.push(`${label}: reevaluateWhen が空です（再評価条件を記載してください）`)
    }
    if (!ISO_DATE.test(entry.acknowledgedAt)) {
      problems.push(`${label}: acknowledgedAt は YYYY-MM-DD 形式である必要があります（実際: "${entry.acknowledgedAt}"）`)
    }
    if (!enumSet.has(entry.major)) {
      problems.push(`${label}: major が aws-cdk-lib の PostgresEngineVersion に実在しません（架空版の先回り登録は禁止）`)
    }
    if (entry.major <= deployedMajor) {
      problems.push(`${label}: major がデプロイ中（${deployedMajor}）以下の stale エントリです（アップグレード済みなら削除してください）`)
    }
    if (seen.has(entry.major)) {
      problems.push(`${label}: major が重複しています（duplicate entry）`)
    }
    seen.add(entry.major)
  }
  return problems
}

/** 有効な見送りを CI ログ用の警告文字列に整形する（空台帳なら空配列）。 */
export function formatDeferralWarnings(deferred: readonly DeferredUpgrade[]): string[] {
  return deferred.map(
    (entry) =>
      `⚠️ 見送り中のアップグレード: PostgreSQL ${entry.major} ` +
      `(${entry.acknowledgedAt} 見送り / 再評価: ${entry.reevaluateWhen}) — 理由: ${entry.reason}`,
  )
}
