#!/usr/bin/env bash
# Portao unico de qualidade do TourVR. Uso: bash scripts/validate.sh [--skip-e2e]
# Roda todas as etapas, mesmo se alguma falhar, e termina com um resumo.
# Sai com 1 se alguma etapa falhou; com 0 se todas passaram ou foram puladas.
#
# `set -e` nao e usado de proposito: o script precisa continuar depois de uma
# etapa com falha para montar o resumo. As funcoes de etapa usam `&&` em cadeia.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

SKIP_E2E=false
[[ "${1:-}" == "--skip-e2e" ]] && SKIP_E2E=true

declare -a RESULTS=()
run_stage() { # run_stage "<nome>" <comando> [argumentos]
  local name="$1"
  shift
  echo "==> [INFO] $name"
  if "$@"; then RESULTS+=("[OK]    $name"); else RESULTS+=("[FALHA] $name"); fi
}

# No Windows, `python3` pode ser um atalho da Microsoft Store que nao executa nada.
python_bin() {
  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null && "$candidate" --version >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done
  echo "[ERRO] Python nao encontrado." >&2
  return 1
}

source_venv() { # Windows usa Scripts/, Linux e macOS usam bin/
  if [[ -f "$1/Scripts/activate" ]]; then
    # shellcheck disable=SC1091
    source "$1/Scripts/activate"
  else
    # shellcheck disable=SC1091
    source "$1/bin/activate"
  fi
}

venv_activate() {
  local venv="services/backend/.venv"
  local python
  if [[ ! -d "$venv" ]]; then
    python="$(python_bin)" && "$python" -m venv "$venv" && source_venv "$venv" \
      && pip install -q -r services/backend/requirements-dev.txt
  else
    source_venv "$venv"
  fi
}

stage_backend() (
  venv_activate && cd services/backend \
    && ruff check . && ruff format --check . && mypy app \
    && pytest --cov=app --cov-fail-under=80
)

stage_node() ( # stage_node <pasta>
  cd "$1" && { [[ -d node_modules ]] || npm ci; } \
    && npm run lint && npm run format:check && npm run test:coverage && npm run build
)

stage_duplication() {
  local paths=(services/backend/app services/frontend/src)
  [[ -d services/vr-app/src ]] && paths+=(services/vr-app/src)
  npx --yes jscpd@4 --config .jscpd.json "${paths[@]}"
}

run_stage "backend" stage_backend
run_stage "frontend" stage_node services/frontend
if [[ -f services/vr-app/package.json ]]; then
  run_stage "vr-app" stage_node services/vr-app
else
  RESULTS+=("[PULADO] vr-app (ainda nao iniciado)")
fi
run_stage "duplicacao" stage_duplication
if $SKIP_E2E; then
  RESULTS+=("[PULADO] e2e (--skip-e2e)")
else
  run_stage "e2e" bash scripts/e2e.sh
fi

echo
echo "===== Resumo ====="
printf '%s\n' "${RESULTS[@]}"
printf '%s\n' "${RESULTS[@]}" | grep -q '^\[FALHA\]' && exit 1
exit 0
