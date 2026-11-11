#!/usr/bin/env bash
# Roda os testes ponta a ponta (Playwright) contra a pilha local em Docker.
# Uso: bash scripts/e2e.sh [argumentos do playwright, ex.: --grep @golden]
# A pilha continua rodando ao final; para parar: bash scripts/down.sh

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
erro() { echo -e "${RED}[ERRO]${NC} $1" >&2; }

cd "$(git rev-parse --show-toplevel)"

if ! docker info >/dev/null 2>&1; then
  erro "Docker nao esta em execucao. Abra o Docker Desktop e tente de novo."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  info "Arquivo .env criado a partir do .env.example."
fi

info "Subindo a pilha (a primeira vez demora alguns minutos)..."
docker compose up -d --build --wait

# O painel nao tem healthcheck: o --wait volta antes do `npm ci && vite` terminar.
PAINEL_URL="http://localhost:3000"
PAINEL_TIMEOUT_S=180
info "Aguardando o painel responder em $PAINEL_URL..."
for ((i = 0; i < PAINEL_TIMEOUT_S; i++)); do
  curl -sf -o /dev/null "$PAINEL_URL" && break
  sleep 1
done
if ! curl -sf -o /dev/null "$PAINEL_URL"; then
  erro "O painel nao respondeu em ${PAINEL_TIMEOUT_S}s. Veja: bash scripts/logs.sh frontend"
  exit 1
fi

cd e2e
[ -d node_modules ] || npm ci
npx playwright install ${CI:+--with-deps} chromium

status=0
npx playwright test "$@" || status=$?
if [ "$status" -ne 0 ]; then
  erro "Testes E2E falharam. Relatorio: cd e2e && npx playwright show-report"
fi
exit "$status"
