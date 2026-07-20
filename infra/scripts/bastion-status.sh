#!/usr/bin/env bash
#
# bastion-status.sh
#
# Bastion EC2 の現在の state と public IPv4 を表示する。
# 停止中は public IPv4 が None と表示される。
#
# Usage:
#   ./infra/scripts/bastion-status.sh <env>
#   ./infra/scripts/bastion-status.sh dev

set -euo pipefail
source "$(dirname "$0")/bastion-common.sh" "$1"

read -r state public_ip < <(aws ec2 describe-instances \
  --instance-ids "$instance_id" \
  --query "Reservations[0].Instances[0].[State.Name, PublicIpAddress]" \
  --output text)

echo "Bastion: ${instance_id} (env: ${env_name})"
echo "  State:     ${state}"
echo "  PublicIP:  ${public_ip}"
echo "  RDS:       ${rds_endpoint}"
