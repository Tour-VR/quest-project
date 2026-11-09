# Alternativa ao setup.sh para quem prefere acessar o GitHub por SSH em vez de HTTPS.
# Testa a chave SSH, faz o Git trocar HTTPS por SSH e prepara os submodulos.
# Uso: .\scripts\posh\ssh-setup.ps1

# Faz erros de cmdlets interromperem o script e cairem no catch final.
# Comandos externos (git, ssh) nao lancam excecao: o codigo de saida e conferido a mao.
$ErrorActionPreference = "Stop"

function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Yellow }
function Write-Ok   { param($msg) Write-Host "[OK] $msg"   -ForegroundColor Green }
function Write-Erro { param($msg) Write-Host "[ERRO] $msg" -ForegroundColor Red }

# Executa um comando git e interrompe o script se ele falhar.
function Invoke-Git {
    git @args
    if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') terminou com codigo $LASTEXITCODE" }
}

try {
    $raiz = git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0) { throw "esta pasta nao esta dentro de um repositorio Git" }
    Set-Location $raiz

    Write-Info "Iniciando a configuracao do ambiente para SSH"

    # O teste vem antes de qualquer alteracao: se a chave nao funcionar, o script sai sem
    # mexer na configuracao global do Git, e o acesso por HTTPS continua funcionando.
    # O GitHub responde ao 'ssh -T' com codigo de saida 1 (nao abre terminal interativo) e escreve a
    # mensagem de sucesso no fluxo de erro. Por isso a saida e redirecionada com 2>&1, o
    # codigo de saida e ignorado e o script procura o texto 'successfully authenticated'.
    # O ErrorActionPreference e relaxado aqui para o texto no fluxo de erro nao virar excecao.
    Write-Info "Testando a conexao SSH com o GitHub..."
    $ErrorActionPreference = "Continue"
    $respostaSsh = (ssh -T git@github.com 2>&1 | Out-String)
    $ErrorActionPreference = "Stop"
    if ($respostaSsh -match "successfully authenticated") {
        Write-Ok "Conexao SSH funcionando"
    } else {
        Write-Erro "A conexao SSH falhou. Nenhuma configuracao foi alterada."
        Write-Info "Verifique se voce tem uma chave SSH; para criar uma: ssh-keygen -t ed25519"
        Write-Info "Depois registre a chave publica na sua conta do GitHub (Settings > SSH and GPG keys)"
        exit 1
    }

    # Faz o Git reescrever automaticamente toda URL https://github.com/ para SSH,
    # inclusive as URLs dos submodulos declaradas no .gitmodules.
    Write-Info "Configurando o Git para usar SSH no lugar de HTTPS..."
    Invoke-Git config --global url."git@github.com:".insteadOf "https://github.com/"
    Write-Ok "Configuracao global alterada"

    # O insteadOf ja cobre o origin, mas gravar a URL SSH deixa explicito o protocolo em uso.
    # O -replace usa expressao regular; [regex]::Escape evita que o '.' de github.com
    # case com qualquer caractere.
    $originAtual = git remote get-url origin
    if ($originAtual -like "https://github.com/*") {
        $originSsh = $originAtual -replace "^$([regex]::Escape('https://github.com/'))", "git@github.com:"
        Invoke-Git remote set-url origin $originSsh
        Write-Ok "URL do origin trocada para SSH"
    }

    # Mesma preparacao do scripts/setup.sh, repetida aqui para nao exigir Git Bash.
    # O submodule update deixa o submodulo em detached HEAD; commits feitos nesse estado
    # se perdem. O checkout de main evita essa perda.
    Write-Info "Sincronizando as URLs dos submodulos..."
    Invoke-Git submodule sync --recursive

    Write-Info "Baixando os submodulos..."
    Invoke-Git submodule update --init --recursive

    Write-Info "Colocando cada submodulo na branch main..."
    Invoke-Git submodule foreach "git checkout main && git pull --ff-only origin main"

    Write-Host ""
    Write-Ok "Configuracao SSH concluida: submodulos na branch main"
    exit 0
} catch {
    # Aqui nao ha equivalente ao $LINENO do Bash; a mensagem do erro e o que resta.
    Write-Erro "Script interrompido inesperadamente: $_"
    exit 1
}
