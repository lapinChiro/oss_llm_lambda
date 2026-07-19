# Docker 開発環境

ローカル開発環境を Docker Compose で構成する。**サービス定義・ポート・環境変数・volume 設定の正は [`compose.yaml`](compose.yaml)**（本 README ではサービスや env を再列挙しない。サービス一覧の概観は CLAUDE.md の Docker 節を参照）。

本番は AWS serverless（CloudFront + S3 + API Gateway + Lambda + RDS/PostgreSQL）で、本 compose は開発専用。本番用イメージの Dockerfile は各 app ディレクトリ（例: `apps/backend/Dockerfile`）にある。

## 起動・停止

```bash
# プロジェクトルートから
docker compose -f docker/compose.yaml up -d     # 起動
docker compose -f docker/compose.yaml down      # 停止
docker compose -f docker/compose.yaml logs -f   # ログ（サービス名を後置で個別表示）

# Docker + Backend + Frontend を並行起動する場合
npm run dev
```

## データベース

開発 DB は PostgreSQL（コンテナ `webapp_postgres`・データは named volume に永続化）。バージョン・接続情報・公開ポートは compose.yaml の `postgres` サービスを正とする。

```bash
npm run db:migrate   # migration 実行
npm run db:psql      # psql コンソール
```

## よく使う操作

```bash
docker compose -f docker/compose.yaml up -d --build            # イメージ再ビルド
docker compose -f docker/compose.yaml up --renew-anon-volumes  # 依存変更後に匿名 volume の node_modules を作り直して起動
docker compose -f docker/compose.yaml down -v                  # volume ごと削除（DB データも消える）
docker exec -it webapp_backend sh                          # コンテナ shell へ入る（他サービスはコンテナ名を変える）
```

node_modules の匿名 volume 隔離（host の clean install 保護）と stale 時の追従手順は、CLAUDE.md の Docker 節と compose.yaml のコメントを正とする。
