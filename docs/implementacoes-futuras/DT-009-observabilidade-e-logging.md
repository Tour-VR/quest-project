# DT-009 — Sem logging estruturado; detalhe de exceção vaza em debug

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P2 |
| **Esforço** | Médio |
| **Artefato** | Backend |
| **Registrada em** | 2026-08-20 |
| **Depende de** | nada |

## Contexto

O backend não configura logging. O único registro produzido é o log de acesso padrão do
Uvicorn. Quando algo falha em execução, não há rastro de qual usuário, qual requisição ou
qual causa. Em paralelo, o tratamento de erro de banco concatena o texto da exceção na
resposta HTTP quando `APP_DEBUG` está ligado.

## Evidência

Nenhuma chamada a `logging`, `logger` ou `structlog` em `app/`. `requirements.txt` não
inclui biblioteca de log.

`app/api/deps.py`:

```python
detail = "Banco de dados indisponivel."
if settings.app_debug:
    detail = f"{detail} Detalhe: {exc}"
```

`app/core/config.py` define `app_debug: bool = True` como padrão — ou seja, o
comportamento de vazamento é o padrão, não a exceção.

O frontend registra erros apenas com `console.error` em `AuthContext.tsx` e `Login.tsx`.

## Impacto

- **Diagnóstico impossível em execução.** Um erro relatado por um aluno ou por um avaliador
  não pode ser investigado — não há histórico.
- **Vazamento de informação.** Com `APP_DEBUG=true`, a mensagem `503` pode expor a string
  de conexão do MongoDB, incluindo host e usuário, para um cliente não autenticado. O
  padrão do código é `true`, então basta esquecer de configurar o `.env`.
- Sem correlação entre requisição e erro, não há como medir taxa de falha, latência ou
  padrões de uso — informação valiosa também para o relatório acadêmico do projeto.

## Proposta

1. Configurar logging estruturado em JSON no `lifespan`, com nível controlado por variável
   de ambiente (`LOG_LEVEL`).
2. Middleware de correlação: gerar um `request_id` por requisição, incluí-lo em todo log e
   devolvê-lo no header de resposta.
3. Registrar em log os eventos relevantes de segurança: falha de login (sem a senha),
   registro de usuário, troca de senha, falha de conexão com o banco.
4. **Nunca** registrar senha, hash de senha ou token — regra explícita em
   `docs/07-convencoes.md`.
5. Desacoplar o vazamento de detalhe do `APP_DEBUG`: registrar a exceção completa no log e
   devolver ao cliente apenas a mensagem genérica e o `request_id`.
6. Alterar o padrão de `app_debug` para `False` em `config.py`, deixando o `.env.example`
   ligá-lo em desenvolvimento.

## Critérios de aceite

- [ ] Logs em JSON, com nível configurável
- [ ] Todo log de requisição carrega um `request_id` correlacionável
- [ ] Resposta `503` não contém detalhe técnico da exceção, independentemente de `APP_DEBUG`
- [ ] Nenhuma senha, hash ou token aparece em log
- [ ] Padrão de `app_debug` no código é `False`

## Notas

Manter simples: `structlog` ou o `logging` da biblioteca padrão com um formatter JSON são
suficientes. Não introduzir stack de observabilidade completa em um projeto deste porte.
