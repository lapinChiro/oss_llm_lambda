#!/usr/bin/env bash
#
# bastion-connect.sh
#
# Bastion EC2 が停止中なら起動し、SSM Agent が Online になるのを待ってから
# localhost:<local_port> -> RDS:5432 の port forwarding を開始する。
# 終了は Ctrl+C。
#
# Usage:
#   ./infra/scripts/bastion-connect.sh <env> [local_port]
#   ./infra/scripts/bastion-connect.sh prod
#   ./infra/scripts/bastion-connect.sh prod 15432
#
# Prerequisites:
#   - aws cli v2
#   - Session Manager plugin

set -euo pipefail
source "$(dirname "$0")/bastion-common.sh" "$1"

local_port="${2:-15432}"

state=$(aws ec2 describe-instances \
  --instance-ids "$instance_id" \
  --query "Reservations[0].Instances[0].State.Name" \
  --output text)

case "$state" in
  running)
    echo "Bastion ${instance_id} is already running (env: ${env_name})."
    ;;
  stopped)
    echo "Starting bastion ${instance_id} (env: ${env_name}) ..."
    aws ec2 start-instances --instance-ids "$instance_id" --no-cli-pager > /dev/null
    echo "Waiting for instance to reach 'running' ..."
    aws ec2 wait instance-running --instance-ids "$instance_id"
    ;;
  pending)
    echo "Bastion ${instance_id} is pending. Waiting for 'running' ..."
    aws ec2 wait instance-running --instance-ids "$instance_id"
    ;;
  stopping)
    echo "Bastion ${instance_id} is stopping. Waiting for 'stopped', then starting again ..."
    aws ec2 wait instance-stopped --instance-ids "$instance_id"
    aws ec2 start-instances --instance-ids "$instance_id" --no-cli-pager > /dev/null
    echo "Waiting for instance to reach 'running' ..."
    aws ec2 wait instance-running --instance-ids "$instance_id"
    ;;
  shutting-down|terminated)
    echo "Error: bastion ${instance_id} is ${state}; it cannot be used for tunneling." >&2
    exit 1
    ;;
  *)
    echo "Error: unsupported bastion state '${state}' for ${instance_id}." >&2
    exit 1
    ;;
esac

echo "Waiting for SSM Agent to become Online ..."
for _ in {1..30}; do
  ping_status=$(aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=${instance_id}" \
    --query "InstanceInformationList[0].PingStatus" \
    --output text)

  if [[ "$ping_status" == "Online" ]]; then
    echo "SSM Agent is Online."
    exec "$(dirname "$0")/bastion-tunnel.sh" "$env_name" "$local_port"
  fi

  sleep 5
done

echo "Error: SSM Agent did not become Online within 150 seconds." >&2
echo "Try './infra/scripts/bastion-status.sh ${env_name}' and rerun this script after a short wait." >&2
exit 1
