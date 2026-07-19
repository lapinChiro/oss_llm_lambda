---
paths:
  - "apps/**/*.test.ts"
  - "apps/**/*.stories.ts"
  - "apps/**/e2e/**"
  - "packages/**/*.test.ts"
  - "infra/test/**"
  - "**/vitest.config.ts"
  - "**/playwright.config.ts"
  - "**/stryker.conf.json"
---

# テスト規約

## 適用条件

テスト、test harness、fixture/factory、またはテスト設定を作成・変更するとき。

## テスト層

| 層 | 主な対象 | 現行の場所・コマンド |
|---|---|---|
| unit | service 規則、composable の競合制御、serialization、pure utility | 各 workspace の `*.test.ts` / `npm test` |
| DB integration | migration、constraint、repository、transaction、query bound | Backend の PGlite test |
| API contract | HTTP status、Zod/OpenAPI response、typed error、CRUD | Backend route/app test + `ApiTester` |
| component/browser | semantic、keyboard、loading/error/empty、CRUD UI | Frontend Storybook / `npm run test:storybook` |
| E2E | Frontend → Backend → PostgreSQL の接続 | Frontend Playwright / `npm run test:e2e` |
| mutation | 重要ロジックの assertion 検知力 | Backend/Frontend Stryker / `npm run test:mutation` |

テスト配置と project selection の正は各 `vitest.config.ts`、`playwright.config.ts`、`stryker.conf.json`。自然文の古い分類を設定より優先しない。

## 制約

### リスクに最も近い層で検証する

- pure rule は unit test、DB constraint/repository/transaction は PGlite、wire contract は API test、DOM/keyboard/a11y は Storybook browser、service 間配線は E2E で検証する。
- 同じ事実を全層で重複 assertion せず、各層が固有に検出できる失敗を割り当てる。
- shared abstraction は active concrete consumer を通じて検証する。抽象化だけを type-check する sample を concrete proof としない。

### integration test は実境界を保つ

- repository、migration、API integration では PGlite/Kysely と実 schema を使う。
- 検証対象の境界を `vi.mock()` / `vi.spyOn()` で置換しない。
- テストごとに所有する DB/data を作り、他テストや既存データを削除・変更しない。
- count/list は自分が作った行または前後差分を検証し、共有 DB の絶対件数へ依存しない。

### factory/fixture は production type を使う

- Frontend は `@app/shared` または production API client が公開する wire type を使う。
- Backend は generated DB type、`src/db/types.ts`、schema inference type を使う。
- テスト専用の手書き shape を production contract の代わりにしない。
- Backend の Todo integration data は `src/testing/todo-data-factory.ts`、HTTP contract は `src/testing/api-tester.ts` を既存の seam として再利用する。

### 非同期 UI は実条件を待つ

- ユーザー操作後の DOM/state/mock 呼び出しが複数 tick や macrotask に依存する場合は `vi.waitFor` で成立条件を待つ。
- 否定 assertion は、それと対になる肯定結果が settle した後に評価する。
- 固定回数の `flushPromises` / `nextTick`、timeout 延長、retry で flaky を覆い隠さない。
- fake timer test では timer を明示的に進め、実 timer 前提の polling を機械適用しない。

### coverage と mutation

- coverage はコードが実行された床であり、assertion の検知力を証明しない。
- 現行 mutation 対象は Backend と Frontend。対象ファイルの正は各 `stryker.conf.json`。
- survived mutant は同値変異か assertion 不足かを調べる。テスト不足を threshold 低下や mutate scope の恣意的縮小で隠さない。

## 禁止事項

- テストを削除・弱体化してエラーを消すこと。
- production contract と異なる fixture shape を作ること。
- shared mutable state、固定 DB path、他者所有データに依存すること。
- E2E で DB 全消去や無関係 row の更新を行うこと。
- coverage threshold の充足だけで十分と判断すること。
- flaky の根本原因を調べず timeout/retry を増やすこと。

## 検証

- 変更した規則のリスクを検出できる assertion がある。
- focused test と、完了時の root full gate が成功する。
- UI/API/DB の境界変更では該当する Storybook、E2E、mutation の必要性を判定し、必要な gate を実行する。
- test helper の参照先と記載コマンドが active tree および `package.json` に存在する。
