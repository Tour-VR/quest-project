# DT-017 — Comentários inadequados nos scripts de setup

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P3 |
| **Esforço** | Baixo |
| **Artefato** | Orquestrador |
| **Registrada em** | 2026-08-20 |
| **Depende de** | nada |

## Contexto

Os scripts `scripts/bash/ssh-setup.sh` e `scripts/posh/ssh-setup.ps1` funcionam
corretamente e resolvem um problema real. Seus comentários, porém, contêm opiniões
depreciativas sobre PowerShell, Microsoft, submódulos Git e sobre quem os utiliza. O
repositório é público, pertence a uma organização identificada e é produto de trabalho
acadêmico avaliável.

## Evidência

Trechos presentes nos arquivos:

- `# PowerShell doesn't have trap for line numbers natively, Microsoft fix your shell`
- `# why the hell github returns success to stderr? I don't care, SVN is better anyways`
- `# If you use submodules, please stop, just make organized folders, Dennis Ritchie would be ashamed of you`
- `exit 1 # 1 because trash bash doesn't allow -1 exit code`
- `# Bring batch again, atleast it does things right`

Há também três erros de grafia repetidos em mensagens exibidas ao usuário: `enviroment`
(environment), `modyfing` (modifying), `syncronizing` (synchronizing) e `atleast` (at least).

## Impacto

- Representação inadequada do grupo, do orientador e da instituição em repositório público.
- O comentário sobre submódulos contradiz diretamente a arquitetura decidida pelo projeto
  (ADR-0001), confundindo quem lê pela primeira vez.
- Comentários deveriam explicar decisões técnicas não óbvias; estes ocupam esse espaço com
  opinião, e há decisões reais nos scripts que ficaram sem explicação — por exemplo, por
  que o teste de SSH busca a string no stream de erro.

## Proposta

1. Substituir os comentários opinativos por explicações técnicas do que cada trecho faz e
   por quê. O comportamento do `ssh -T` do GitHub, em particular, merece uma nota real:
   ele escreve a mensagem de sucesso no stream de erro, o que justifica a redireção.
2. Corrigir a grafia nas mensagens exibidas ao usuário.
3. Padronizar o idioma das mensagens — os scripts falam inglês, o resto do projeto fala
   português. Decidir e aplicar uniformemente.
4. Aproveitar a revisão para incorporar o checkout de `main` nos submódulos
   ([DT-004](DT-004-configuracao-submodulos.md)) — mesmo arquivo, mesma passada.

## Critérios de aceite

- [ ] Nenhum comentário depreciativo nos dois scripts
- [ ] Comentários explicam decisões técnicas não óbvias
- [ ] Mensagens ao usuário sem erros de grafia
- [ ] Idioma das mensagens padronizado

## Notas

Prioridade baixa em impacto técnico, mas custo de correção próximo de zero. Executar junto
com DT-004, que altera os mesmos arquivos.
