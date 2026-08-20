# NNN — Título do plano

| | |
|---|---|
| **Status** | Rascunho \| Aguardando validação \| Validado \| Em execução \| Concluído \| Cancelado |
| **Dívidas atendidas** | DT-NNN, DT-NNN |
| **ADRs relacionadas** | ADR-NNNN — ou "nenhuma" |
| **Artefatos afetados** | Orquestrador \| Backend \| Frontend \| VR App |
| **Planejado em** | AAAA-MM-DD |
| **Validado em** | AAAA-MM-DD por *(nome)* |
| **Executado em** | AAAA-MM-DD · commit `xxxxxxx` |

---

## 1. Objetivo

Uma ou duas frases: o que este plano entrega e por que agora.

## 2. Contexto verificado

O que foi confirmado por leitura direta do código durante o planejamento — não suposição.
Citar `arquivo:linha`.

```
services/backend/app/core/config.py:20
```

## 3. Escopo

**Está dentro:**

- item concreto e verificável
- item concreto e verificável

**Está fora** *(explicitar evita deriva de escopo durante a execução)*:

- item que poderia parecer incluído mas não está — e por quê

## 4. Decisões tomadas no planejamento

Tudo o que exigiu escolha, já resolvido aqui. A sessão de execução não decide nada.

| Questão | Decisão | Motivo |
|---|---|---|
| | | |

## 5. Passos de implementação

Numerados, na ordem de execução, com arquivo e ação concretos.

### Passo 1 — título

**Arquivo:** `services/backend/app/exemplo.py`

O que fazer, com precisão suficiente para não exigir interpretação. Trecho ilustrativo se
ajudar:

```python
# exemplo do resultado esperado
```

### Passo 2 — título

...

## 6. Testes

Quais testes criar ou alterar, e o que cada um verifica.

| Arquivo | Teste | Verifica |
|---|---|---|
| | | |

Comando de verificação:

```bash
cd services/backend && pytest -v
```

## 7. Documentação a atualizar

- [ ] `docs/0X-....md` — o que muda
- [ ] `docs/implementacoes-futuras/DT-NNN-....md` — marcar como Resolvida
- [ ] `docs/tasks/README.md` — atualizar o índice

## 8. Critérios de aceite

- [ ] Condição verificável 1
- [ ] Condição verificável 2
- [ ] Suíte de testes passando
- [ ] Documentação atualizada no mesmo commit

## 9. Riscos e pontos de atenção

O que pode dar errado, e o que fazer se der.

## 10. Commits esperados

```
feat(escopo): descrição
docs: atualiza <documento> e marca DT-NNN como resolvida
```

---

## Prompt de delegação

> Preencher apenas **após** a validação do plano. Copiar este bloco integralmente para
> abrir a sessão de execução. Ver `_template-prompt-delegacao.md`.

```text
(prompt aqui)
```
