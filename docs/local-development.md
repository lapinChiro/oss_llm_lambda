# Local development

## Docker-first setup

```bash
npm ci
cp apps/backend/.env.docker.example apps/backend/.env
npm run docker:up
docker compose -f docker/compose.yaml ps
```

Compose は PostgreSQL health → migration + Backend health → Frontend の順で起動します。依存変更後は `docker compose -f docker/compose.yaml up -d --renew-anon-volumes`、完全な DB 初期化は `npm run docker:clean` を使います（データを削除します）。

## Host app processes

IDE のデバッガや高速 HMR が必要なら PostgreSQL だけを Docker で起動し、host 用 env を使います。

```bash
docker compose -f docker/compose.yaml up -d postgres
cp apps/backend/.env.local.example apps/backend/.env
npm run dev:local
```

## Database

```bash
npm run db:migrate
npm run db:migrate:down
npm run db:generate-types
npm run db:psql
```

migration を変更したら、空 volume への up、down、再 up と型生成を確認します。generated type は migration の代替ではなく、実 schema との drift 検出です。

## Environment variables

| Name | Required | Default/example | Purpose |
| --- | --- | --- | --- |
| `DB_HOST` | yes | `postgres` / `localhost` | PostgreSQL host |
| `DB_PORT` | yes | `5432` / `5435` | PostgreSQL port |
| `DB_USER` | yes | `postgres` | Database user |
| `DB_PASSWORD` | yes | local-only `password` | Database password |
| `DB_NAME` | yes | `app_dev` | Database name |
| `DATABASE_URL` | codegen | assembled from values above | Kysely code generation |
| `FRONTEND_URL` | yes | `http://localhost:5173` | CORS origin |
| `VITE_API_BASE_URL` | optional | `http://localhost:3000` | Browser API origin; empty in same-origin production |
| `PORT` | optional | `3000` | Backend listen port |
| `LOG_LEVEL` | optional | runtime default | Structured log level |

Committed `.env.*.example` files contain local placeholders only. Never commit `.env`, AWS credentials, or real passwords.
