# CLAUDE.md

Vue 3 + Hono + PostgreSQL + AWS CDK のフルスタック Web アプリケーションテンプレート。応答は必ず日本語で行う。

## Tech Stack

- Frontend: Vue 3、TypeScript、Vite、Vue Router、Storybook、Vitest、Playwright
- Backend: Hono、Node.js、TypeScript、Zod/OpenAPI、Kysely
- Database: PostgreSQL 17（テストは PGlite）
- Infrastructure: AWS CDK（CloudFront + private S3、HTTP API + Lambda、VPC + RDS PostgreSQL）
- Development: npm workspaces、Docker Compose

## Commands

各 script の正は root と各 workspace の `package.json`。完了判定には対象テストだけでなく root の full gate を使う。

```bash
npm ci
cp apps/backend/.env.docker.example apps/backend/.env
npm run docker:up
npm run quality
npm run quality:full
npm run test:e2e
npm run synth -w @app/infra
```

- ローカルサービスは PostgreSQL、Backend、Frontend の 3 つ。外部サービス資格情報は不要。
- `npm run docker:clean` は DB volume を削除する。データ破棄が目的の場合だけ使う。
- migration、型生成、Docker、テスト層ごとの詳細は README と `docs/` を参照する。

## Architecture

```text
Frontend: View -> composable -> injected API client -> shared wire contract
Backend:  route/schema -> service -> repository -> Kysely -> PostgreSQL
```

- `apps/frontend`: Vue SPA。画面、composable、typed API client を分離する。
- `apps/backend`: Hono API。route/schema、service、repository、DB/test harness を分離する。
- `packages/types`: Frontend/Backend が共有する wire contract。
- `packages/utils`: domain-free な共通 utility。
- `infra`: typed context を使う AWS CDK stack。
- `docker`: PostgreSQL、Backend、Frontend のローカル実行環境。
- `docs`: architecture、local development、testing、deployment、customization の開発者文書。

Todo は参照 vertical slice である。新 entity は同じ依存方向で追加し、汎用基盤へ業務知識を混ぜない。実行時境界は Zod/OpenAPI と DB constraint、compile-time 境界は strict TypeScript と generated DB types で守る。

## Core Principles

- KISS: 現在の要件を満たす最小限の複雑さを選ぶ。
- YAGNI: 現在使う concrete consumer のない拡張点を作らない。
- DRY: コード形状ではなく知識の重複を除く。共通化で結合が増えるなら重複を残す。
- 直交性: 独立して変わる責務を分離する。
- 対称性: 抽象レベルで同じものは同じ構造で扱い、差異には実際の理由を持たせる。
- 型断定、lint suppression、テスト弱体化で失敗を迂回せず根本原因を修正する。
- コメントにはコードから読めない理由、不変条件、同期先だけを書く。
- migration、contract、実装、テスト、README/`docs` の drift を変更時に閉じる。

## Testing and Quality

- Backend は unit/API/repository/migration/PGlite integration test を使い分ける。
- Frontend は unit、Storybook browser component test、Playwright E2E を使い分ける。
- Backend/Frontend の重要ロジックは Stryker mutation testing で検知力を確認する。
- coverage は実行の床であり、十分性の証明ではない。
- type-check、Oxlint、ESLint、test、build、Syncpack、Knip は 0 error・0 warning を維持する。
- テスト規約の正は `.claude/rules/testing.md`、実行順の正は `.claude/skills/quality-check/SKILL.md`。

## Claude Code Configuration

- `CLAUDE.md` は常時必要なプロジェクト指示だけを持つ。
- `.claude/rules/*.md` は継続的な規律。`paths` frontmatter がある rule は該当ファイルを扱うときに適用する。
- `.claude/skills/*/SKILL.md` は task-specific workflow。該当タスクでは省略せず使用する。
- `.claude/agents/*.md` は project subagent 定義。
- `.claude/settings.json` は project-shared な Claude Code 設定と権限。
- `.agents/skills/modern-web-guidance` は install 済み skill の実体で、`.claude/skills/modern-web-guidance` から参照する。

## Workflow

該当する場合は次の skill を使用する。

- 新機能・バグ修正: `/tdd`
- テストの新規作成・変更前: `/test-design`
- UI の設計・変更: `/ux-design` discovery、完了時は review
- 機能追加後の設計整理: `/refactoring-check`
- 実装レビュー: `/review-dev`
- 静的品質・自動テスト: `/quality-check`
- Docker 実機確認: `/check-local`
- 調査: `/investigation`
- PRD の作成・レビュー・完了: `/prd-template`、`/review-prd`、`/prd-completion`
- backlog/TODO の操作: 対応する backlog/todo skill
- rule/skill の変更: `/rule-maintenance`（記述規約は `/rule-writing`）

複数ステップ作業は `.claude/rules/task-tracking.md` に従って追跡する。作業後は refactoring、review、quality、必要な UX/実機確認、文書同期まで完了させる。

## Code Conventions

- `any` を使わず、境界で narrowing する。
- 非 null assertion (`!`) と、null/undefined を消すだけの型 assertion を使わない。型ガードまたは明示 throw を使う。
- ES Modules と strict TypeScript を維持する。
- DB の UUID、timestamp、timezone 規律は対応する `.claude/rules/` を正とする。
- source/config/test の具体的な一覧や件数を自然文へ複製せず、実ファイルを参照する。

## Operational Rules

- 不明な仕様、外部ツールの挙動、更新されうる事実を推測で補わない。repository の source、実行結果、公式ドキュメントなど信頼できる一次情報を調べる。
- `.env`、`secret.json`、credential の内容を表示・追跡しない。
- 既存変更と未追跡ファイルはユーザー所有として保護する。
- `.claude/settings.json` の deny 対象である git 状態変更を実行・計画・subagent への指示に含めない。
- 問題や不整合を発見したら原因を調べ、スコープ内なら修正し、スコープ外なら具体的な追跡項目を残す。
- ユーザーから Claude 自身の挙動修正を受けた場合は一般化し、project rule/skill または user-level preference の適切な保存先を提案し、確認後に記録する。
