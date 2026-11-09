#!/usr/bin/env bash
# Alternativa ao setup.sh para quem prefere acessar o GitHub por SSH em vez de HTTPS.
# Testa a chave SSH, faz o Git trocar HTTPS por SSH e prepara os submodulos.
# Uso: bash scripts/bash/ssh-setup.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
erro() { echo -e "${RED}[ERRO]${NC} $1" >&2; }

trap 'erro "Script interrompido inesperadamente na linha $LINENO"' ERR

RAIZ="$(git rev-parse --show-toplevel)"
cd "$RAIZ"

info "Iniciando a configuracao do ambiente para SSH"

# O teste vem antes de qualquer alteracao: se a chave nao funcionar, o script sai sem
# mexer na configuracao global do Git, e o acesso por HTTPS continua funcionando.
# O GitHub responde ao 'ssh -T' com codigo de saida 1 (nao abre terminal interativo) e escreve a
# mensagem de sucesso no fluxo de erro. Por isso a saida e redirecionada com 2>&1, o
# codigo de saida e ignorado e o script procura o texto 'successfully authenticated'.
info "Testando a conexao SSH com o GitHub..."
resposta_ssh=$(ssh -T git@github.com 2>&1 || true)
if echo "$resposta_ssh" | grep -q "successfully authenticated"; then
    ok "Conexao SSH funcionando"
else
    erro "A conexao SSH falhou. Nenhuma configuracao foi alterada."
    info "Verifique se voce tem uma chave SSH; para criar uma: ssh-keygen -t ed25519"
    info "Depois registre a chave publica na sua conta do GitHub (Settings > SSH and GPG keys)"
    exit 1
fi

# Faz o Git reescrever automaticamente toda URL https://github.com/ para SSH,
# inclusive as URLs dos submodulos declaradas no .gitmodules.
info "Configurando o Git para usar SSH no lugar de HTTPS..."
git config --global url."git@github.com:".insteadOf "https://github.com/"
ok "Configuracao global alterada"

# O insteadOf ja cobre o origin, mas gravar a URL SSH deixa explicito o protocolo em uso.
origin_atual=$(git remote get-url origin)
if [[ "$origin_atual" == https://github.com/* ]]; then
    git remote set-url origin "${origin_atual/https:\/\/github.com\//git@github.com:}"
    ok "URL do origin trocada para SSH"
fi

# A preparacao dos submodulos (sync, update e checkout de main) fica num so lugar.
info "Preparando os submodulos..."
bash "$RAIZ/scripts/setup.sh"

echo ""
ok "Configuracao SSH concluida"
