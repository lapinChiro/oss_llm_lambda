---
paths:
  - "apps/backend/src/db/**"
  - "apps/backend/src/repositories/**"
  - "apps/backend/src/services/**"
  - "apps/backend/src/schemas/**"
  - "infra/lib/**"
---

# Timezone と時刻ストレージ規約

## 適用条件

DB の date/datetime 列、時刻の書込み・読出し・変換、API の日時 wire value、Lambda timezone を変更するとき。

## 現行契約

- 絶対時刻は PostgreSQL `timestamptz` で保持する。
- 日付だけを表す値を追加する場合は PostgreSQL `date` を使い、pg parser/codegen では string として扱う。
- `created_at` / `updated_at` の初期値は migration の DB default が生成する。
- Todo の更新時刻は service が更新操作時の `Date` を明示し、wire contract では ISO 8601 string に変換する。
- Backend/Migration Lambda の `TZ` は CDK source で UTC に固定する。

## 制約

- datetime と calendar date を同じ型・意味で扱わない。
- 新しい datetime 列に `timestamp without time zone` を使わない。
- timezone を暗黙の host local timezone に依存させない。
- API 境界では `Date` object を直接 wire へ漏らさず、schema と一致する ISO string にする。
- DB default、service 更新、generated DB type、shared wire type、テストを同時に同期する。
- 特定地域の business timezone が要件になった場合は、要件と IANA timezone を明示し、汎用 helper を推測で追加しない。

## 禁止事項

- `toISOString().split('T')[0]` で calendar date を生成すること。
- `AT TIME ZONE 'UTC' AT TIME ZONE ...` のような歴史的二段変換を根拠なく導入すること。
- Lambda/runtime の timezone を ambient environment に依存させること。
- 現在存在しない旧製品の date helper、認証、batch Lambda を前提にすること。

## 検証

- migration test で column type/default と round-trip を実証する。
- service/API test で timestamp wire value が schema と一致することを確認する。
- `apps/backend/src/db/connection.ts` の DATE parser と codegen option が一致することを確認する。
- Lambda 数を自然文へ固定せず、`infra/lib/stacks/` の全 NodejsFunction を調べて `TZ: 'UTC'` の有無を確認する。
