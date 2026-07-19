#!/usr/bin/env bash
#
# init-db-password.sh
#
# 初回 CDK デプロイ前に DB_PASSWORD を SSM Parameter Store に登録する。
# RDS の credentials が SSM Parameter Store を参照するため、
# CDK デプロイ前にこのパラメータが存在している必要がある。
#
# 既にパラメータが存在する場合はスキップする（上書きしない）。
#
# Usage:
#   ./infra/scripts/init-db-password.sh <env> <password> [--profile <profile>]
#   ./infra/scripts/init-db-password.sh dev MySecurePassword123
#   APP_NAME=example ./infra/scripts/init-db-password.sh dev MySecurePassword123 --profile my-profile
#
# Prerequisites:
#   - aws cli (v2)
#   - 適切な AWS 認証情報が設定済みであること

set -euo pipefail

# ================================================================
# 引数チェック
# ================================================================
if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <env> <password> [--profile <profile>]" >&2
  echo "  env:      dev | prod" >&2
  echo "  password: RDS master password" >&2
  exit 1
fi

ENV="$1"
PASSWORD="$2"
shift 2

# --profile オプションの解析
AWS_OPTS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      AWS_OPTS+=(--profile "$2")
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

APP_NAME="${APP_NAME:-webapp}"
SSM_PREFIX="${SSM_PREFIX:-/${APP_NAME}/${ENV}}"
SSM_PARAM_NAME="${SSM_PREFIX}/DB_PASSWORD"

# ================================================================
# 前提条件チェック
# ================================================================
if ! command -v aws &>/dev/null; then
  echo "Error: aws is not installed" >&2
  exit 1
fi

# ================================================================
# 既存パラメータチェック
# ================================================================
echo "=== Initializing DB_PASSWORD for env: ${ENV} ==="

EXISTING=$(aws ssm get-parameter --name "$SSM_PARAM_NAME" --query "Parameter.Value" --output text "${AWS_OPTS[@]}" 2>/dev/null || true)

if [[ -n "$EXISTING" && "$EXISTING" != "None" ]]; then
  echo "Parameter ${SSM_PARAM_NAME} already exists. Skipping."
  echo "To overwrite, delete it first: aws ssm delete-parameter --name ${SSM_PARAM_NAME}"
  exit 0
fi

# ================================================================
# パスワード登録
# ================================================================
aws ssm put-parameter \
  --name "$SSM_PARAM_NAME" \
  --value "$PASSWORD" \
  --type SecureString \
  --no-cli-pager \
  "${AWS_OPTS[@]}"

echo "Created: ${SSM_PARAM_NAME}"
echo ""
echo "This password will be used as the RDS master password."
echo "Proceed with CDK deployment: cd infra && npx cdk deploy -c env=${ENV} --all"
