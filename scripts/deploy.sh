#!/usr/bin/env bash
# Sobe ou atualiza a pilha de producao (ADR-0010). Roteiro completo em docs/11-implantacao.md.
#
# Uso, na VM, dentro do repositorio:
#   bash scripts/deploy.sh             # atualiza o codigo (git pull) e sobe
#   bash scripts/deploy.sh --no-pull   # sobe a versao que ja esta na pasta (volta de versao)
# Teste local com TOURVR_DOMAIN=localhost: DEPLOY_INSECURE=1 bash scripts/deploy.sh --no-pull

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
erro() { echo -e "${RED}[ERRO]${NC} $1" >&2; }

cd "$(git rev-parse --show-toplevel)"

ENV_FILE="deploy/.env.prod"
COMPOSE=(docker compose -f deploy/docker-compose.prod.yml --env-file "$ENV_FILE")

pull=1
if [ "${1:-}" = "--no-pull" ]; then
    pull=0
fi

if [ ! -f "$ENV_FILE" ]; then
    erro "Arquivo $ENV_FILE nao encontrado."
    erro "Crie com: cp deploy/.env.prod.example $ENV_FILE e preencha os segredos (openssl rand -hex 32)."
    exit 1
fi

if grep -Eq '=troque$' "$ENV_FILE"; then
    erro "$ENV_FILE ainda tem valores 'troque'. Gere os segredos com: openssl rand -hex 32"
    exit 1
fi

# Le TOURVR_DOMAIN sem executar o arquivo inteiro como script.
TOURVR_DOMAIN=$(grep -E '^TOURVR_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)
if [ -z "$TOURVR_DOMAIN" ]; then
    erro "TOURVR_DOMAIN vazio em $ENV_FILE."
    exit 1
fi

if [ "$pull" -eq 1 ]; then
    info "Atualizando o repositorio (main)..."
    git pull --ff-only origin main
fi

# Producao usa exatamente os commits fixados no orquestrador (ponteiros dos submodulos),
# e nao a main de cada submodulo: so vai ao ar o que passou pelo fechamento do plano.
info "Posicionando os submodulos nos commits fixados..."
git submodule sync --recursive
git submodule update --init --recursive

info "Construindo e subindo a pilha (o primeiro build leva varios minutos)..."
"${COMPOSE[@]}" up -d --build --wait

curl_opts=(-fsS --max-time 10)
if [ "${DEPLOY_INSECURE:-0}" = "1" ]; then
    curl_opts+=(-k)
fi

# O certificado pode levar alguns segundos para ser emitido na primeira subida.
info "Conferindo a API em https://api.$TOURVR_DOMAIN/health/ ..."
for tentativa in 1 2 3 4 5 6; do
    if curl "${curl_opts[@]}" "https://api.$TOURVR_DOMAIN/health/" | grep -q '"status":"ok"'; then
        ok "API respondendo com banco conectado."
        break
    fi
    if [ "$tentativa" -eq 6 ]; then
        erro "A API nao respondeu. Ultimas linhas dos logs:"
        "${COMPOSE[@]}" logs --tail 50 backend web
        exit 1
    fi
    sleep 10
done

echo ""
ok "TourVR no ar (versao $(git rev-parse --short HEAD)):"
echo "  Painel:     https://painel.$TOURVR_DOMAIN"
echo "  Visitante:  https://tour.$TOURVR_DOMAIN"
echo "  API:        https://api.$TOURVR_DOMAIN/docs"
echo ""
info "Primeiro administrador (so na primeira vez):"
echo "  ${COMPOSE[*]} exec backend python -m app.cli create-admin --email <email> --password <senha>"
