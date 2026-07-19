#!/usr/bin/env bash
#
# bastion-connect-psql.sh
#
# Bastion EC2 が停止中なら起動し、SSM tunnel を background で張り、
# SSM Parameter Store から DB_PASSWORD を取得して psql で接続する。
# psql 終了時に tunnel も終了する。
#
# Usage:
#   ./infra/scripts/bastion-connect-psql.sh <env> [local_port]
#   ./infra/scripts/bastion-connect-psql.sh prod
#   ./infra/scripts/bastion-connect-psql.sh prod 15432
#
# Prerequisites:
#   - aws cli v2
#   - Session Manager plugin
#   - psql 14+

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/bastion-common.sh" "$1"

local_port="${2:-15432}"
db_user="postgres"
db_name="$database_name"
password_parameter_name="${ssm_prefix}/DB_PASSWORD"
tunnel_pid=""
tunnel_log=""

cleanup() {
  if [[ -n "${tunnel_pid}" ]] && kill -0 "$tunnel_pid" 2>/dev/null; then
    echo "Stopping SSM tunnel ..."
    kill "$tunnel_pid" 2>/dev/null || true
    wait "$tunnel_pid" 2>/dev/null || true
  fi

  if [[ -n "${tunnel_log}" && -f "${tunnel_log}" ]]; then
    rm -f "$tunnel_log"
  fi
}

trap cleanup EXIT INT TERM

ensure_bastion_running() {
  local state
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
}

wait_for_ssm_online() {
  echo "Waiting for SSM Agent to become Online ..."
  for _ in {1..30}; do
    local ping_status
    ping_status=$(aws ssm describe-instance-information \
      --filters "Key=InstanceIds,Values=${instance_id}" \
      --query "InstanceInformationList[0].PingStatus" \
      --output text)

    if [[ "$ping_status" == "Online" ]]; then
      echo "SSM Agent is Online."
      return
    fi

    sleep 5
  done

  echo "Error: SSM Agent did not become Online within 150 seconds." >&2
  exit 1
}

start_tunnel() {
  local params
  params=$(printf '{"host":["%s"],"portNumber":["5432"],"localPortNumber":["%s"]}' \
    "$rds_endpoint" "$local_port")

  tunnel_log=$(mktemp)
  echo "Starting SSM tunnel localhost:${local_port} -> ${rds_endpoint}:5432 ..."
  aws ssm start-session \
    --target "$instance_id" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "$params" \
    > "$tunnel_log" 2>&1 &
  tunnel_pid=$!

  for _ in {1..30}; do
    if ! kill -0 "$tunnel_pid" 2>/dev/null; then
      echo "Error: SSM tunnel failed to start." >&2
      cat "$tunnel_log" >&2
      exit 1
    fi

    if grep -Eq "Port [0-9]+ opened|Waiting for connections" "$tunnel_log"; then
      echo "SSM tunnel is ready on localhost:${local_port}."
      return
    fi

    sleep 1
  done

  echo "Error: SSM tunnel did not become ready within 30 seconds." >&2
  cat "$tunnel_log" >&2
  exit 1
}

connect_psql() {
  echo "Fetching DB password from ${password_parameter_name} ..."
  local db_password
  db_password=$(aws ssm get-parameter \
    --name "$password_parameter_name" \
    --with-decryption \
    --query Parameter.Value \
    --output text)

  echo "Connecting to ${db_name} on localhost:${local_port} as ${db_user} (env: ${env_name}) ..."
  PGPASSWORD="$db_password" psql \
    -h localhost \
    -p "$local_port" \
    -U "$db_user" \
    -d "$db_name"
}

ensure_bastion_running
wait_for_ssm_online
start_tunnel
connect_psql
