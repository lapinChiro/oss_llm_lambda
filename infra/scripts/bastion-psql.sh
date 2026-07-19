#!/usr/bin/env bash
#
# bastion-psql.sh
#
# SSM tunnel 起動済みの localhost:<local_port> に対して、SSM Parameter Store から
# DB_PASSWORD を取得し、psql で RDS PostgreSQL に接続する。
#
# Usage:
#   ./infra/scripts/bastion-psql.sh <env> [local_port]
#   ./infra/scripts/bastion-psql.sh prod
#   ./infra/scripts/bastion-psql.sh prod 15432
#
# Prerequisites:
#   - aws cli v2
#   - psql 14+
#   - ./infra/scripts/bastion-tunnel.sh <env> [local_port] が別ターミナルで起動済み

set -euo pipefail
source "$(dirname "$0")/bastion-common.sh" "$1"

local_port="${2:-15432}"
db_user="postgres"
db_name="$database_name"
password_parameter_name="${ssm_prefix}/DB_PASSWORD"

echo "Fetching DB password from ${password_parameter_name} ..."
db_password=$(aws ssm get-parameter \
  --name "$password_parameter_name" \
  --with-decryption \
  --query Parameter.Value \
  --output text)

echo "Connecting to ${db_name} on localhost:${local_port} as ${db_user} (env: ${env_name}) ..."
PGPASSWORD="$db_password" exec psql \
  -h localhost \
  -p "$local_port" \
  -U "$db_user" \
  -d "$db_name"
