#!/usr/bin/env bash
#
# bastion-tunnel.sh
#
# SSM Session Manager の AWS-StartPortForwardingSessionToRemoteHost ドキュメントを
# 使い、ローカル localhost:<local_port> -> RDS:5432 のフォワードを張る。
# 終了は Ctrl+C。
#
# 別ターミナルで psql 接続:
#   DB_PASSWORD=$(aws ssm get-parameter --name /webapp/<env>/DB_PASSWORD \
#     --with-decryption --query Parameter.Value --output text) \
#     && PGPASSWORD="$DB_PASSWORD" psql -h localhost -p <local_port> -U postgres -d app
#
# Usage:
#   ./infra/scripts/bastion-tunnel.sh <env> [local_port]
#   ./infra/scripts/bastion-tunnel.sh dev
#   ./infra/scripts/bastion-tunnel.sh dev 15432
#
# Prerequisites:
#   - aws cli v2
#   - Session Manager plugin (https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)

set -euo pipefail
source "$(dirname "$0")/bastion-common.sh" "$1"

local_port="${2:-15432}"

params=$(printf '{"host":["%s"],"portNumber":["5432"],"localPortNumber":["%s"]}' \
  "$rds_endpoint" "$local_port")

echo "Forwarding localhost:${local_port} -> ${rds_endpoint}:5432 via ${instance_id}"
echo "(Press Ctrl+C to terminate)"

aws ssm start-session \
  --target "$instance_id" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "$params"
