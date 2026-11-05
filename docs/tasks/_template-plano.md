# NNN — Título do plano

| | |
|---|---|
| **Status** | Rascunho \| Aguardando validação \| Validado \| Em execução — *nome* \| Em revisão — *nome* \| Concluído \| Cancelado |
| **Fase** | N — nome da fase |
| **Depende de** | NNN, NNN — ou "nenhum" |
| **Dívidas atendidas** | DT-NNN, DT-NNN — ou "nenhuma" |
| **ADRs relacionadas** | ADR-NNNN — ou "nenhuma" |
| **Artefatos afetados** | Orquestrador \| Backend \| Frontend \| VR App |
| **Planejado em** | AAAA-MM-DD |
| **Validado em** | AAAA-MM-DD por *(nome)* |
| **Executado em** | AAAA-MM-DD · PRs: *links* |

---

## 1. Objetivo

Uma ou duas frases: o que este plano entrega e por que agora.

## 2. Leia antes de começar

Documentos de `docs/` que a sessão de execução precisa ler, além do protocolo.

## 3. Estado esperado ao iniciar

O que deve existir no código quando a execução começar — confirmado por leitura direta
(`arquivo:linha`) ou produzido por planos anteriores. A sessão de execução confere isto e
para se o código estiver diferente.

## 4. Escopo

**Dentro:** itens concretos e verificáveis.

**Fora** *(explicitar evita deriva de escopo)*: o que poderia parecer incluído mas não está,
e por quê.

## 5. Decisões tomadas no planejamento

Tudo o que exigiu escolha, já resolvido. A sessão de execução não decide nada.

| Questão | Decisão | Motivo |
|---|---|---|
| | | |

## 6. Passos de implementação

Numerados, na ordem de execução, com repositório, arquivo e ação concretos. Trechos
ilustrativos quando ajudarem. Cada passo termina com uma **Verificação** quando possível.

### Passo 1 — título

**Arquivo:** `services/backend/app/exemplo.py`

...

## 7. Testes

| Arquivo | Teste | Verifica |
|---|---|---|
| | | |

Comandos de verificação.

## 8. Documentação a atualizar

- [ ] `docs/0X-....md` — o que muda
- [ ] `docs/implementacoes-futuras/DT-NNN-....md` — marcar como Resolvida

## 9. Critérios de aceite

- [ ] Condição verificável
- [ ] `bash scripts/validate.sh` passando (a partir do plano 005)
- [ ] Documentação atualizada

## 10. Commits esperados

Por repositório, na branch `plano/NNN-slug`.

## 11. Riscos e pontos de atenção

O que pode dar errado, e o que fazer se der.

## 12. Verificação pelo aluno

Roteiro curto, sem programação, para o aluno conferir o resultado com os próprios olhos
(navegador, terminal, arquivos).

---

## Prompt de delegação

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/NNN-slug.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
