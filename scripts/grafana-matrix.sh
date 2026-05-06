#!/usr/bin/env bash
set -euo pipefail

COMMAND="${1:-status}"
shift || true

# Comma-separated Grafana versions, e.g. "11.6.5,12.0.0,13.0.0"
VERSIONS_RAW="${GRAFANA_MATRIX_VERSIONS:-11.6.5,12.0.0}"
BASE_PORT="${GRAFANA_MATRIX_BASE_PORT:-3100}"
PROJECT_PREFIX="${GRAFANA_MATRIX_PROJECT_PREFIX:-comparequeries-grafana}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

IFS=',' read -r -a VERSIONS <<< "${VERSIONS_RAW}"

compose_cmd() {
  local project="$1"
  shift
  docker-compose -p "${project}" -f "${ROOT_DIR}/docker-compose.yaml" "$@"
}

run_for_version() {
  local version="$1"
  local idx="$2"
  local port=$((BASE_PORT + idx))
  local major="${version%%.*}"
  local project="${PROJECT_PREFIX}-${major}"
  local container="leoswing-comparequeries-datasource-g${major}"
  local data_volume="${PROJECT_PREFIX}-v${major}-data"

  case "${COMMAND}" in
    up)
      echo "Starting Grafana ${version} on localhost:${port} (project=${project})"
      GRAFANA_VERSION="${version}" \
      GRAFANA_PORT="${port}" \
      GRAFANA_CONTAINER_NAME="${container}" \
      GRAFANA_DATA_VOLUME="${data_volume}" \
      compose_cmd "${project}" up --build --force-recreate -d
      ;;
    down)
      echo "Stopping Grafana ${version} (project=${project})"
      GRAFANA_VERSION="${version}" \
      GRAFANA_PORT="${port}" \
      GRAFANA_CONTAINER_NAME="${container}" \
      GRAFANA_DATA_VOLUME="${data_volume}" \
      compose_cmd "${project}" down
      ;;
    status)
      echo "=== Grafana ${version} (project=${project}, port=${port}) ==="
      GRAFANA_VERSION="${version}" \
      GRAFANA_PORT="${port}" \
      GRAFANA_CONTAINER_NAME="${container}" \
      GRAFANA_DATA_VOLUME="${data_volume}" \
      compose_cmd "${project}" ps
      ;;
    *)
      echo "Unknown command: ${COMMAND}" >&2
      echo "Usage: scripts/grafana-matrix.sh [up|down|status]" >&2
      exit 1
      ;;
  esac
}

for idx in "${!VERSIONS[@]}"; do
  run_for_version "${VERSIONS[$idx]}" "${idx}"
done
