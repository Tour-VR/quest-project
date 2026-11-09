#!/usr/bin/env bash
# Sobe o ambiente local completo (MongoDB, backend e painel) com Docker Compose.
# Uso: bash scripts/up.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
erro() { echo -e "${RED}[ERRO]${NC} $1" >&2; }

cd "$(git rev-parse --show-toplevel)"

if ! docker info >/dev/null 2>&1; then
  erro "Docker nao esta em execucao. Abra o Docker Desktop e tente de novo."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  info "Arquivo .env criado a partir do .env.example."
  info "Troque JWT_SECRET_KEY no .env por uma chave gerada:"
  info "  python -c \"import secrets; print(secrets.token_hex(32))\""
fi

info "Subindo os servicos (a primeira vez demora alguns minutos)..."
docker compose up -d --build --wait

ok "Ambiente no ar."
echo "  Painel: http://localhost:3000"
echo "  API:    http://localhost:8000/docs"
