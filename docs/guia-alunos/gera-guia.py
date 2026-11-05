"""Gera guia-do-aluno.html e guia-do-aluno.pdf a partir do template.

Uso (na raiz do quest-project):
    python docs/guia-alunos/gera-guia.py

O PDF e impresso pelo Chrome ou Edge em modo headless. Rode de novo sempre que a lista de
planos em docs/tasks/README.md mudar.
"""

from __future__ import annotations

import base64
import html
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "guia-do-aluno.template.html"
OUT_HTML = HERE / "guia-do-aluno.html"
OUT_PDF = HERE / "guia-do-aluno.pdf"
LOGO = HERE / "logo-ifg.png"

FASES = {
    "0": "Fase 0 · Fundação de qualidade",
    "1": "Fase 1 · Domínio do campus no backend",
    "2": "Fase 2 · Painel administrativo",
    "3": "Fase 3 · App do visitante, modo AR (celular)",
    "4": "Fase 4 · App do visitante, modo VR (Quest 3)",
}

# (numero, slug, titulo, fase, depende de, o que entrega)
PLANOS = [
    ("001", "higiene-orquestrador", "Higiene do orquestrador", "0", "—",
     "Corrige o .gitignore, faz os submódulos abrirem na main e cria o scripts/setup.sh."),
    ("002", "ambiente-docker-compose", "Ambiente Docker Compose", "0", "001",
     "Banco, backend e painel sobem com um único comando."),
    ("003", "qualidade-backend", "Qualidade do backend", "0", "002",
     "Lint, tipagem estrita e cobertura mínima de 80% nos testes do backend."),
    ("004", "qualidade-frontend", "Qualidade do frontend", "0", "002",
     "Lint, testes automatizados e componentes menores no painel."),
    ("005", "validacao-e-e2e", "Validação única e primeiro E2E", "0", "003, 004",
     "Um comando que verifica tudo e o primeiro teste ponta a ponta (login)."),
    ("006", "integracao-continua", "Integração contínua", "0", "005",
     "O GitHub roda as verificações automaticamente em todo Pull Request."),
    ("007", "seguranca-backend", "Segurança do backend", "1", "006",
     "Chave secreta obrigatória, e-mail único no banco e limite de tentativas de login."),
    ("008", "papeis-e-administrador", "Papéis e administrador", "1", "007",
     "Só administradores usam o painel; um comando cria o primeiro administrador."),
    ("009", "pontos-de-interesse-backend", "Pontos de interesse no backend", "1", "008",
     "A API passa a cadastrar os locais do campus, com rascunho e publicação."),
    ("010", "visitas-e-metricas-backend", "Visitas e métricas no backend", "1", "009",
     "Registra visitas anônimas e calcula os números do painel."),
    ("011", "base-do-painel", "Base do painel", "2", "008",
     "Menu de navegação, aviso de sessão expirada e tipos gerados da API."),
    ("012", "cadastro-de-pontos-painel", "Cadastro de pontos no painel", "2", "009, 011",
     "Criar, editar, publicar e excluir pontos pelo painel."),
    ("013", "upload-de-midia", "Upload de mídia", "2", "012",
     "Enviar as fotos de cada ponto pelo painel."),
    ("014", "qr-codes", "QR Codes imprimíveis", "2", "012",
     "Folha A4 com o QR Code de cada ponto, pronta para imprimir e afixar."),
    ("015", "metricas-perfil-usuarios", "Métricas, perfil e usuários no painel", "2", "010, 011",
     "Números reais no painel, tela de perfil e gestão de usuários."),
    ("016", "fundacao-app-visitante", "Fundação do app do visitante", "3", "006",
     "Cria o app que roda no celular e no Quest, com as mesmas regras de qualidade."),
    ("017", "pagina-do-ponto", "Página do ponto (modo AR)", "3", "010, 016",
     "O que o visitante vê ao ler o QR: nome, história e fotos do local."),
    ("018", "leitor-qr-golden-path", "Leitor de QR e golden path completo", "3", "014, 017",
     "Leitor de QR dentro do app e teste do caminho completo, do cadastro à visita."),
    ("019", "panoramas-e-conexoes", "Panoramas e conexões", "4", "013, 017",
     "Foto 360° de cada ponto e as ligações entre pontos vizinhos."),
    ("020", "cena-vr-360", "Cena VR 360°", "4", "019",
     "Visita imersiva em 360° no navegador do Meta Quest 3."),
    ("021", "navegacao-vr-e-encerramento", "Navegação VR e encerramento", "4", "018, 020",
     "Passar de um ponto a outro em VR, roteiro de teste no Quest e documentação final."),
]

PROMPT = (
    "Você é a sessão de EXECUÇÃO do projeto TourVR.\n"
    "Execute o plano docs/tasks/{num}-{slug}.md.\n"
    "Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "
    "\"Prompt 1 — EXECUTAR\" etapa por etapa.\n"
    "Meu nome, para registrar no plano: <SEU NOME>"
)


def render_planos() -> str:
    """Monta os cartoes dos planos agrupados por fase."""

    partes: list[str] = []
    fase_atual = None
    for num, slug, titulo, fase, deps, desc in PLANOS:
        if fase != fase_atual:
            partes.append(f"<h4 style=\"margin-top:14px\">{html.escape(FASES[fase])}</h4>")
            fase_atual = fase
        prompt = html.escape(PROMPT.format(num=num, slug=slug))
        partes.append(
            '<article class="fase-plan">'
            f'<div class="t-head"><span class="t-num wide">{num}</span>'
            f"<div><h3>{html.escape(titulo)}</h3></div></div>"
            f'<div class="chips"><span class="chip"><em>Depende de</em> {deps}</span>'
            f'<span class="chip"><em>Arquivo</em> {num}-{slug}.md</span></div>'
            f'<p class="desc">{html.escape(desc)}</p>'
            f'<pre class="prompt">{prompt}</pre>'
            "</article>"
        )
    return "\n".join(partes)


def find_browser() -> str:
    """Localiza Chrome ou Edge para imprimir o PDF."""

    candidatos = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        shutil.which("google-chrome") or "",
        shutil.which("chromium") or "",
    ]
    for caminho in candidatos:
        if caminho and Path(caminho).exists():
            return caminho
    raise SystemExit("Chrome ou Edge nao encontrado para gerar o PDF.")


def main() -> None:
    logo = base64.b64encode(LOGO.read_bytes()).decode()
    page = TEMPLATE.read_text(encoding="utf-8")
    page = page.replace("{{LOGO}}", logo).replace("{{PLANOS}}", render_planos())
    page = page.replace(
        "<title>",
        "<!-- Gerado por gera-guia.py a partir de guia-do-aluno.template.html. "
        "Nao editar a mao. -->\n<title>",
        1,
    )
    OUT_HTML.write_text(page, encoding="utf-8")

    subprocess.run(
        [
            find_browser(),
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            f"--print-to-pdf={OUT_PDF}",
            OUT_HTML.as_uri(),
        ],
        check=True,
    )
    print(f"Gerado: {OUT_HTML}\nGerado: {OUT_PDF}")


if __name__ == "__main__":
    main()
