#!/usr/bin/env bash
#
# bastion-start.sh
#
# Bastion EC2 を起動する。waiter で running まで待つ。
#
# Usage:
#   ./infra/scripts/bastion-start.sh <env>
#   ./infra/scripts/bastion-start.sh dev

set -euo pipefail
source "$(dirname "$0")/bastion-common.sh" "$1"

echo "Starting bastion ${instance_id} (env: ${env_name}) ..."
aws ec2 start-instances --instance-ids "$instance_id" --no-cli-pager > /dev/null

echo "Waiting for instance to reach 'running' ..."
aws ec2 wait instance-running --instance-ids "$instance_id"

echo "Bastion ${instance_id} is running."
echo "Run './bastion-status.sh ${env_name}' to view public IP, then './bastion-tunnel.sh ${env_name}'."
