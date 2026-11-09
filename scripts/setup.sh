#!/usr/bin/env bash
# Prepara o repositorio orquestrador: baixa os submodulos e deixa cada um na branch main.
# Nao altera o protocolo de acesso (HTTPS ou SSH): usa o que o Git ja estiver configurado.
# Uso: bash scripts/setup.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
erro() { echo -e "${RED}[ERRO]${NC} $1" >&2; }

# Os comandos de submodulo precisam rodar na raiz; assim o script funciona de qualquer pasta.
cd "$(git rev-parse --show-toplevel)"

# Copia as URLs do .gitmodules para a configuracao local, caso tenham mudado desde o clone.
info "Sincronizando as URLs dos submodulos..."
git submodule sync --recursive

# Baixa os submodulos que ainda nao existem e posiciona cada um no commit fixado.
info "Baixando os submodulos..."
git submodule update --init --recursive

# O submodule update deixa o submodulo em detached HEAD; commits feitos nesse estado nao
# pertencem a nenhuma branch e se perdem. O checkout de main evita essa perda.
# O --ff-only impede que o pull crie um merge inesperado se houver commits locais.
info "Colocando cada submodulo na branch main..."
git submodule foreach 'git checkout main && git pull --ff-only origin main'

# Confere o resultado: nenhum submodulo pode terminar fora da main.
info "Conferindo as branches..."
falhou=0
for caminho in $(git config -f .gitmodules --get-regexp 'submodule\..*\.path' | awk '{print $2}'); do
    branch_atual=$(git -C "$caminho" branch --show-current)
    if [ "$branch_atual" = "main" ]; then
        ok "$caminho esta na branch main"
    else
        erro "$caminho nao esta na branch main (atual: '${branch_atual:-detached HEAD}')"
        falhou=1
    fi
done

if [ "$falhou" -ne 0 ]; then
    erro "Algum submodulo nao ficou na branch main. Veja as mensagens acima."
    exit 1
fi

echo ""
info "Proximo passo: 'docker compose up', assim que o plano 002 estiver concluido."
ok "Submodulos prontos: todos na branch main."
