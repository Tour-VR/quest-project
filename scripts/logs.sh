#!/usr/bin/env bash
# Acompanha os logs do ambiente local. Aceita o nome de um servico.
# Uso: bash scripts/logs.sh [backend|frontend|mongo]

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
erro() { echo -e "${RED}[ERRO]${NC} $1" >&2; }

cd "$(git rev-parse --show-toplevel)"

info "Mostrando logs (Ctrl+C para sair)..."
docker compose logs -f "$@"
