# Full-stack web application template

Vue 3 + Hono + PostgreSQL を、ローカル開発から AWS 配備まで一貫して扱う TypeScript モノレポです。Todo CRUD は starter の飾りではなく、Frontend → API → service → repository → DB の依存方向、runtime validation、エラー境界、各テスト層を示す参照実装です。認証や外部 SaaS の資格情報なしで起動できます。

## 必要なもの

- Node.js 24.15 以上（`.node-version` を参照）
- npm 11 以上
- Docker Engine と Docker Compose v2
- AWS 配備時のみ AWS CLI v2 と認証済みアカウント

## クイックスタート

```bash
npm ci
cp apps/backend/.env.docker.example apps/backend/.env
npm run docker:up
```

Backend は PostgreSQL の health check 後に migration を実行し、Frontend は Backend が healthy になってから起動します。

- Frontend: <http://localhost:5173>
- API health: <http://localhost:3000/api/health>
- OpenAPI JSON: <http://localhost:3000/openapi.json>
- API reference: <http://localhost:3000/docs>
- PostgreSQL: `localhost:5435`（database `app_dev`）

停止は `npm run docker:down`、DB volume も初期化する場合だけ `npm run docker:clean` を使います。

## 構成

```text
apps/frontend   Vue SPA: View -> composable -> injected API client
apps/backend    Hono API: route/API -> service -> repository -> Kysely
packages/types  Frontend/Backend 共有の wire contract
packages/utils  ドメイン非依存 utility
infra           AWS CDK: CloudFront/S3 + HTTP API/Lambda + VPC/RDS
docker          ローカルの Frontend/Backend/PostgreSQL
docs            開発、テスト、配備、カスタマイズのガイド
```

詳細は [architecture](docs/architecture.md) を参照してください。

## 主なコマンド

```bash
npm run dev                 # Docker DB + host Backend/Frontend（高速な日常開発）
npm run docker:up           # 3サービスを Docker で起動
npm run db:migrate          # migration up
npm run db:migrate:down     # 直近 migration down
npm run db:generate-types   # 実 DB から Kysely 型を生成

npm run quality             # Syncpack/type/lint/unit/build/Knip
npm run quality:full        # quality + coverage + Storybook + mutation
npm run test:e2e            # PostgreSQL + Frontend/Backend の Todo smoke
npm run synth -w @app/infra # 既定値で CDK synth
```

検査の役割、実行順、CI との対応は [testing](docs/testing.md)、環境変数と DB 操作は [local development](docs/local-development.md) にあります。

## AWS 配備

既定では custom domain や固定 account ID を必要とせず、CloudFront の生成ドメインを使います。初回は `/<appName>/<env>/DB_PASSWORD` を SSM SecureString に登録してから deploy します。

```bash
./infra/scripts/init-db-password.sh dev '<strong-password>'
npm run deploy:dev -w @app/infra
```

custom domain、production retention、CI/CD の設定を含む手順は [AWS deployment](docs/aws-deployment.md) を参照してください。

## テンプレートとして使う

最初に root package 名、`appName`、database 名、SSM prefix、リポジトリ metadata を自分の値へ変更します。その後 Todo vertical slice を一層ずつ別 entity に置換し、各境界のテストを保ったまま最後に Todo を削除します。具体的な順序と rename checklist は [customization](docs/customization.md) にあります。

## 開発規律

新機能は TDD で進め、unit/integration/component/E2E/mutation をリスクに応じて選びます。完了前に UX、refactoring、文書同期、full quality gate を確認します。`.claude/rules` と `.claude/skills` はこの流れをエージェントからも実行できる形で保持しています。原則と手順の入口は [development workflow](docs/development-workflow.md) です。

## License

MIT
