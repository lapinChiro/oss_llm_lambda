# ================================================================
# Backend Lambda Dockerfile
# ビルドコンテキスト: monorepo ルート
# 用途: Backend API Lambda / Migration Lambda (CMD オーバーライド)
# ================================================================

# ---- Build Stage ----
FROM node:26-slim AS builder

WORKDIR /workspace

# 依存定義ファイルをコピー（Docker キャッシュ最適化）
COPY package.json package-lock.json ./
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY apps/backend/package.json apps/backend/

# workspace を含む依存インストール
RUN npm ci --workspace=apps/backend --workspace=packages/types --workspace=packages/utils --include-workspace-root

# ソースコピー
COPY packages/types/ packages/types/
COPY packages/utils/ packages/utils/
COPY apps/backend/ apps/backend/

# packages/types をコンパイル（Backend が参照するランタイム値を含む）
WORKDIR /workspace/packages/types
RUN npx tsc -p tsconfig.build.json

# packages/utils をコンパイル（Backend が参照する Logger 等を含む）
WORKDIR /workspace/packages/utils
RUN npx tsc --build tsconfig.build.json --force

# Backend をコンパイル（tsconfig.build.json で test / MSW モック / dev エントリを除外）
WORKDIR /workspace/apps/backend
RUN npx tsc -p tsconfig.build.json

# AWS RDS CA バンドルをダウンロード（SSL 証明書検証用）
RUN node -e "const https=require('https'),fs=require('fs'); \
  const f=fs.createWriteStream('/workspace/rds-global-bundle.pem'); \
  https.get('https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem', r=>r.pipe(f));"

# ---- Production Dependencies Stage ----
FROM node:26-slim AS deps

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY apps/backend/package.json apps/backend/

# production 依存のみインストール
RUN npm ci --workspace=apps/backend --workspace=packages/types --workspace=packages/utils --include-workspace-root --omit=dev
RUN mkdir -p /workspace/apps/backend/node_modules

# ---- Runtime Stage ----
FROM public.ecr.aws/lambda/nodejs:24

# コンパイル済み JS をコピー
COPY --from=builder /workspace/apps/backend/dist ${LAMBDA_TASK_ROOT}/dist

# production node_modules をコピー
COPY --from=deps /workspace/node_modules ${LAMBDA_TASK_ROOT}/node_modules
# ワークスペースローカルの node_modules をマージ（ホイストされなかったパッケージ対応）
COPY --from=deps /workspace/apps/backend/node_modules/ ${LAMBDA_TASK_ROOT}/node_modules/

# packages/types のコンパイル済み JS + package.json をコピー
COPY --from=builder /workspace/packages/types/dist/ ${LAMBDA_TASK_ROOT}/node_modules/@app/shared/dist/
COPY --from=builder /workspace/packages/types/package.json ${LAMBDA_TASK_ROOT}/node_modules/@app/shared/

# packages/utils のコンパイル済み JS + package.json をコピー
COPY --from=builder /workspace/packages/utils/dist ${LAMBDA_TASK_ROOT}/node_modules/@app/utils/dist
COPY --from=builder /workspace/packages/utils/package.json ${LAMBDA_TASK_ROOT}/node_modules/@app/utils/

# package.json をコピー（ESM の "type": "module" 解決に必要）
COPY --from=builder /workspace/apps/backend/package.json ${LAMBDA_TASK_ROOT}/

# RDS CA バンドル（SSL 証明書検証用）
COPY --from=builder /workspace/rds-global-bundle.pem /opt/rds-ca/global-bundle.pem

# ハンドラー指定（CDK 側で CMD オーバーライド可能）
# Backend API: dist/src/lambda.lambdaHandler
# Migration:   dist/src/migrate-handler.handler （CDK 側で cmd オーバーライド）
CMD ["dist/src/lambda.lambdaHandler"]
