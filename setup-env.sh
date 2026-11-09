#!/usr/bin/env bash
# ==============================================================================
# RHOV Sphere Portal & OpenShift Virtualization: 환경 변수 로드 및 매니페스트 렌더링
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
EXAMPLE_FILE="${SCRIPT_DIR}/.env.example"

if [ ! -f "$ENV_FILE" ] && [ -f "$EXAMPLE_FILE" ]; then
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
fi

set -a
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
set +a

export BASE_DOMAIN="${BASE_DOMAIN:-example.local}"
export CLUSTER_NAME="${CLUSTER_NAME:-rhov-cluster}"
export APPS_DOMAIN="${APPS_DOMAIN:-apps.${CLUSTER_NAME}.${BASE_DOMAIN}}"

render_template() {
    local src="$1"
    local dest="$2"
    [ ! -f "$src" ] && return 0
    if command -v envsubst >/dev/null 2>&1; then
        envsubst < "$src" > "$dest"
    else
        cp "$src" "$dest"
    fi
}

render_manifests() {
    mkdir -p "${SCRIPT_DIR}/rendered/cluster-infra"
    for file in "${SCRIPT_DIR}"/manifests/*.yaml; do
        [ -f "$file" ] && render_template "$file" "${SCRIPT_DIR}/rendered/$(basename "$file")"
    done
    for file in "${SCRIPT_DIR}"/manifests/cluster-infra/*.yaml; do
        [ -f "$file" ] && render_template "$file" "${SCRIPT_DIR}/rendered/cluster-infra/$(basename "$file")"
    done
    echo "Rendered manifests to ${SCRIPT_DIR}/rendered/"
}

case "${1:-}" in
    --render|render) render_manifests ;;
    *) echo "Loaded environment variables for ${CLUSTER_NAME}.${BASE_DOMAIN}" ;;
esac
