#!/usr/bin/env bash
# Para o ambiente local. Os dados do banco sao preservados.
# Uso: bash scripts/down.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
erro() { echo -e "${RED}[ERRO]${NC} $1" >&2; }

cd "$(git rev-parse --show-toplevel)"

docker compose down
ok "Servicos parados. Os dados do banco foram preservados."
