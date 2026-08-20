# DT-014 — Containerização parcial e sem `.dockerignore`

| | |
|---|---|
| **Status** | Aberta |
| **Prioridade** | P2 |
| **Esforço** | Baixo |
| **Artefato** | Todos |
| **Registrada em** | 2026-08-20 |
| **Depende de** | nada; complementa DT-002 |

## Contexto

Apenas o backend possui `Dockerfile`. Ele funciona, mas copia o diretório inteiro para a
imagem antes de instalar dependências, sem `.dockerignore`. O frontend não tem
containerização alguma.

## Evidência

`services/backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Não existe `.dockerignore` em `services/backend`. Não existe `Dockerfile` em
`services/frontend`.

## Impacto

- **`COPY . .` sem `.dockerignore`** leva para dentro da imagem tudo o que estiver no
  diretório: `.venv` local (centenas de MB), `.git`, `__pycache__`, `.pytest_cache` e —
  criticamente — o arquivo **`.env` com segredos reais**, se existir na máquina de quem
  faz o build.
- **`COPY` antes do `pip install`** invalida o cache de camadas a cada alteração de código,
  reinstalando todas as dependências em cada build.
- **Roda como root** dentro do container, sem necessidade.
- **Sem healthcheck**, um orquestrador não consegue saber se o serviço está pronto, apesar
  de existir `/health/`.
- **Frontend sem imagem** impede compor o ambiente completo ([DT-002](DT-002-orquestracao-ambiente-local.md))
  e qualquer deploy conteinerizado.

## Proposta

1. Criar `.dockerignore` no backend cobrindo `.venv`, `.git`, `__pycache__`,
   `.pytest_cache`, `tests`, `*.md` e **`.env`**.
2. Reordenar o `Dockerfile`: copiar `requirements.txt`, instalar, e só então copiar o
   código — aproveitando o cache de camadas.
3. Criar usuário não-root e mudar para ele antes do `CMD`.
4. Acrescentar `HEALTHCHECK` apontando para `/health/`.
5. Criar `Dockerfile` do frontend em dois estágios: build com Node, servir o `dist/` com
   Nginx ou similar. Criar também o `.dockerignore` correspondente (`node_modules`, `dist`,
   `.env`).
6. Integrar ambos ao `docker-compose.yml` de [DT-002](DT-002-orquestracao-ambiente-local.md).

## Critérios de aceite

- [ ] `.dockerignore` presente em ambos os submódulos, incluindo `.env`
- [ ] Alteração apenas no código não reinstala dependências no build
- [ ] Container do backend executa como usuário não-root
- [ ] `HEALTHCHECK` configurado e reportando corretamente
- [ ] Imagem do frontend serve o build de produção

## Notas

O item 1 é urgente e independente do resto: hoje, qualquer `docker build` executado por um
aluno que tenha `.env` local embute credenciais reais na imagem.
