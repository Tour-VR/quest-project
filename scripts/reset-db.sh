#!/usr/bin/env bash
# Apaga TODOS os dados do MongoDB local, apos confirmacao.
# Uso: bash scripts/reset-db.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
erro() { echo -e "${RED}[ERRO]${NC} $1" >&2; }

cd "$(git rev-parse --show-toplevel)"

read -r -p "Isto apaga TODOS os dados do banco local. Digite APAGAR para confirmar: " resposta
if [ "$resposta" != "APAGAR" ]; then
  info "Cancelado. Nada foi apagado."
  exit 0
fi

docker compose down
docker volume rm tourvr_mongo-data
ok "Banco local apagado. Rode bash scripts/up.sh para subir um banco vazio."
