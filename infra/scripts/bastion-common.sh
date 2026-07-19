#!/usr/bin/env bash
#
# bastion-common.sh
#
# Bastion 系スクリプトの共通 source。直接実行ではなく、
# 各 bastion-*.sh から `source` で読み込んで使う。
#
# CloudFormation Outputs から bastion EC2 の instance_id および
# RDS endpoint を解決し、以下の変数として export する:
#   - env_name
#   - stack_name
#   - instance_id
#   - rds_endpoint
#
# Usage:
#   source "$(dirname "$0")/bastion-common.sh" "$1"
#
# Prerequisites:
#   - aws cli v2
#   - AWS credential / region が解決できる状態
#     (aws configure 済 / AWS_PROFILE + AWS_REGION 設定済 / SSO ログイン済)

set -euo pipefail

# 直接実行 (./bastion-common.sh ...) を禁止。bastion-{start,stop,...}.sh から source されること。
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Error: ${BASH_SOURCE[0]##*/} must be sourced, not executed directly." >&2
  echo "Use bastion-{start,stop,status,tunnel}.sh instead." >&2
  exit 1
fi

env_name="${1:?env required: dev|prod}"

if [[ "$env_name" != "dev" && "$env_name" != "prod" ]]; then
  echo "Error: env must be 'dev' or 'prod' (got: ${env_name})" >&2
  exit 1
fi

app_name="${APP_NAME:-webapp}"
database_name="${DATABASE_NAME:-app}"
ssm_prefix="${SSM_PREFIX:-/${app_name}/${env_name}}"
stack_name="${app_name}-${env_name}-stateful"

instance_id=$(aws cloudformation describe-stacks \
  --stack-name "$stack_name" \
  --query "Stacks[0].Outputs[?OutputKey=='BastionInstanceId'].OutputValue" \
  --output text)

if [[ -z "$instance_id" || "$instance_id" == "None" ]]; then
  echo "Error: BastionInstanceId not found in stack ${stack_name}" >&2
  exit 1
fi

rds_endpoint=$(aws cloudformation describe-stacks \
  --stack-name "$stack_name" \
  --query "Stacks[0].Outputs[?OutputKey=='RdsEndpoint'].OutputValue" \
  --output text)

if [[ -z "$rds_endpoint" || "$rds_endpoint" == "None" ]]; then
  echo "Error: RdsEndpoint not found in stack ${stack_name}" >&2
  exit 1
fi
