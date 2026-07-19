#!/usr/bin/env bash
#
# bastion-stop.sh
#
# Bastion EC2 を停止する。waiter で stopped まで待つ。
# 停止すると public IPv4 は解放される (次回起動時に新しい IP が割当される)。
#
# Usage:
#   ./infra/scripts/bastion-stop.sh <env>
#   ./infra/scripts/bastion-stop.sh dev

set -euo pipefail
source "$(dirname "$0")/bastion-common.sh" "$1"

echo "Stopping bastion ${instance_id} (env: ${env_name}) ..."
aws ec2 stop-instances --instance-ids "$instance_id" --no-cli-pager > /dev/null

echo "Waiting for instance to reach 'stopped' ..."
aws ec2 wait instance-stopped --instance-ids "$instance_id"

echo "Bastion ${instance_id} is stopped."
