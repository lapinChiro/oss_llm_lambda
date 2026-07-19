/**
 * PostgreSQL バージョンアップ見送り台帳（acknowledgement ledger）
 * ============================================================
 *
 * L3 enum currency test（`postgres-version-currency.test.ts`）は、aws-cdk-lib の
 * `PostgresEngineVersion` に「デプロイ中メジャーより新しく、台帳に未登録のメジャー」が
 * 現れたら CI を fail させる。これは「新しい PostgreSQL が使えるようになった＝上げるか検討せよ」
 * という明示シグナルである。
 *
 * 検知で fail したときの対応は次の二択のみ:
 *   (a) アップグレードする（実スタックの VER_NN と DEPLOYED_POSTGRES_MAJOR を更新）
 *   (b) 検討の上で見送る（DEFERRED_POSTGRES_UPGRADES に理由付きで追記 + 対応 TODO 起票）
 *
 * 詳細手順は infra/README.md「L3 が fail したときの対応」を正とする。
 *
 * 禁止: テストの無効化 / it.skip / `DEPLOYED_POSTGRES_MAJOR` の無言の引き上げ（= 実スタックを
 * 上げずに検知だけ黙らせる blanket disable）。見送りは必ず版ごとに理由付きで台帳に残すこと。
 *
 * `DEPLOYED_POSTGRES_MAJOR` は「実際にデプロイしているメジャー」、`DEFERRED_POSTGRES_UPGRADES` は
 * 「検討の上で見送った新版」。両者は役割が異なる（前者は実スタックと常に一致させる）。
 */

import type { DeferredUpgrade } from './version-currency.js'

export type { DeferredUpgrade }

/**
 * 実スタック（stateful-stack.ts）がデプロイしている PostgreSQL メジャー。
 * 実スタックの `PostgresEngineVersion.VER_17` と一致させること。
 */
export const DEPLOYED_POSTGRES_MAJOR = 17

/**
 * 検討の上で意図的に見送った新メジャー版の台帳。
 *
 * PostgreSQL 18: aws-cdk-lib 2.257 時点で `VER_18` が利用可能だが、RDS のメジャー
 * バージョンアップは prod の計画的マイグレーション（スナップショット取得・互換検証・
 * 計画停止）を要し、CI 検知基盤の整備（本 PRD）とはスコープが異なるため見送る。
 */
export const DEFERRED_POSTGRES_UPGRADES: readonly DeferredUpgrade[] = [
  {
    major: 18,
    acknowledgedAt: '2026-06-16',
    reason:
      'RDS の PostgreSQL 17→18 メジャーアップグレードは prod の計画的マイグレーション（スナップショット・互換検証・計画停止）を要し、CI 検知基盤整備とはスコープが別。専用のアップグレード PRD で実施する。',
    reevaluateWhen:
      'PostgreSQL メジャーアップグレードの計画停止枠が取れた時点、または 17 の RDS サポート終了が近づいた時点（TODO C「PostgreSQLのバージョンアップ」と連動）。',
  },
]
