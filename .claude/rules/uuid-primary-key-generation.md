---
paths:
  - "apps/backend/src/db/**"
  - "apps/backend/src/db/**/*.test.ts"
---

# uuid 主キー生成規約

## 適用条件

DB schema に新しいテーブルを追加するとき（migration で `CREATE TABLE` するとき）、または既存テーブルの主キー定義を変更するとき。

## 背景

独立生成する uuid 主キーは DB 側 `DEFAULT gen_random_uuid()` を持たせ、uuid 未指定 INSERT でも schema が不変条件を守る。本規約は migration と repository/API の生成方法が非対称になっても DB 側 backstop を失わないための規律である。

## 制約

### 1. 独立生成される uuid 単一主キーは DB 側 `DEFAULT gen_random_uuid()` を宣言する

- uuid 型の単一列主キーには `DEFAULT gen_random_uuid()` を付与する（`CREATE TABLE` の列定義、または `ALTER COLUMN ... SET DEFAULT`）。
- アプリ層は必要なら uuid を明示的に渡してよい。明示値は DEFAULT を上書きし、DEFAULT は uuid 未指定 INSERT の backstop として働く。

### 2. FK を兼ねる共有/継承 PK は対象外

主キーが同時に FK である列（親テーブルの identity を継承する 1:1 の共有 PK）には DEFAULT を付与しない。値は親から継承されるべきで、独立生成の `gen_random_uuid()` は意味的に不適。

### 3. 複合主キー・自然キーは対象外

uuid 単一主キー列のみが本規約の対象。複合主キー・自然キーのテーブルは対象外。

### enforcement（migration integration test）

`apps/backend/src/db/migrate.test.ts` は空 DB へ全 migration を適用し、uuid を渡さない INSERT が有効な UUID を生成することを実 DB で検証する。テーブル追加時は同じ risk をこの migration integration 層で追加検証する。テーブル数が増えて横断不変条件になった場合に限り、実 DB introspection のメタテストを検討する。

## 禁止事項

- 独立生成の uuid 単一主キーを `DEFAULT gen_random_uuid()` なしで `CREATE` すること。
- FK を兼ねる共有/継承 PK に `gen_random_uuid()` DEFAULT を付けること（親 identity の継承に反する）。
- migration integration test を弱体化・削除して DEFAULT 不在を通すこと。

## 検証

- `apps/backend/src/db/migrate.test.ts` の UUID/default invariant test が GREEN。
- 新規追加した migration の uuid 単一主キー列に `DEFAULT gen_random_uuid()` 宣言がある（FK 兼用の共有 PK を除く）。

## 関連

- [`tz-storage-convention`](tz-storage-convention.md)（DB 側生成の兄弟規約。audit timestamp）
- [`testing.md`](testing.md)（integration / migration テストの配置・PGlite 規約）
