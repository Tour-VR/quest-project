# 11 — Implantação e atualização em produção

> Decisão em [ADR-0010](08-decisoes-arquiteturais.md). Arquivos em `deploy/` e
> `scripts/deploy.sh` (ver [02-artefato-orquestrador.md](02-artefato-orquestrador.md)).
> Última verificação: 2026-11-26.

## Visão geral

```
                Internet (HTTPS, portas 80 e 443)
                              │
                ┌─────────────▼──────────────┐
                │ web — Caddy                │  certificados automáticos
                │  painel.<dominio> → /srv/painel (build do painel)
                │  tour.<dominio>   → /srv/tour   (build do app do visitante)
                │                     /api/*, /media/* → backend
                │  api.<dominio>    → backend
                └─────────────┬──────────────┘
                              │ rede interna do compose
                ┌─────────────▼──────────────┐     ┌──────────────────────┐
                │ backend — FastAPI :8000    ├────►│ mongo — sem porta    │
                │ volume media-data          │     │ exposta, com senha   │
                └────────────────────────────┘     └──────────────────────┘
```

| Item | Valor atual |
|---|---|
| VM | Ubuntu 24.04, 1 vCPU, 2 GB RAM + 2 GB swap, IP `201.79.39.177` |
| Pasta do projeto na VM | `/opt/tourvr` |
| Domínio | `201-79-39-177.sslip.io` (variável `TOURVR_DOMAIN`) |
| Painel | `https://painel.201-79-39-177.sslip.io` |
| App do visitante | `https://tour.201-79-39-177.sslip.io` (vai nos QR Codes) |
| API | `https://api.201-79-39-177.sslip.io` (`/docs` para a documentação interativa) |
| Segredos | `/opt/tourvr/deploy/.env.prod` — só na VM, permissão `600`, nunca versionado |
| Log da última implantação | `/var/log/tourvr-deploy.log` |

**O que vai ao ar:** exatamente os commits que o orquestrador fixa para cada submódulo (os
ponteiros). Um plano só chega à produção depois do **fechamento** (Prompt 3 do
[protocolo](tasks/protocolo-execucao.md)), que é quando os ponteiros são atualizados.

---

## Atualizar a produção (rotina)

Use sempre que um ou mais planos forem **concluídos** e se quiser levar as melhorias ao ar.

**Quem:** o orientador ou a pessoa que ele indicar com acesso SSH à VM.
**Quando:** depois do fechamento do plano, nunca com plano em revisão.

1. Confira no índice [`tasks/README.md`](tasks/README.md) que os planos a publicar estão
   `Concluído`, e no GitHub que a CI da `main` do `quest-project` está verde.
2. Entre na VM e atualize:

   ```bash
   ssh root@201.79.39.177
   cd /opt/tourvr
   bash scripts/deploy.sh 2>&1 | tee /var/log/tourvr-deploy.log
   ```

   O script baixa a `main`, posiciona os submódulos nos commits fixados, reconstrói o que
   mudou e confere a API. Leva de 3 a 15 minutos (o build do app do visitante é o mais
   lento). Termina com `[OK] TourVR no ar (versao <commit>)`.
3. Confira no navegador, nesta ordem:
   - painel: entrar, abrir a lista de pontos;
   - visitante: abrir um ponto publicado (`https://tour.<dominio>/p/<slug>`), ver a foto;
   - celular: ler o QR Code de um ponto impresso ou na tela do painel.
4. Avise no grupo: `Produção atualizada para <commit> — planos NNN, NNN.`

**Dados não são apagados na atualização.** Banco (`mongo-data`), fotos (`media-data`) e
certificados (`caddy-data`) ficam em volumes que sobrevivem ao rebuild. Nunca rode
`docker compose ... down -v` em produção: o `-v` apaga esses volumes.

**Mudança no formato dos dados.** O MongoDB não tem migração de esquema. Um plano que
mudar o formato de documentos já gravados precisa trazer, no próprio plano, o passo de
conversão a executar na produção — e a atualização desse plano deve ser combinada antes.

### Voltar à versão anterior

Se a atualização quebrou algo:

```bash
cd /opt/tourvr
git log --oneline -10                 # escolha o commit que estava no ar antes
git checkout <commit>
bash scripts/deploy.sh --no-pull      # reconstrói a versão escolhida
```

Para retomar o fluxo normal depois da correção: `git checkout main` e a rotina acima.

### Backup manual antes de uma atualização arriscada

Ainda não há backup automático (dívida registrada em
[DT-027](implementacoes-futuras/DT-027-backup-producao.md)). Até lá:

```bash
cd /opt/tourvr
C="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod"
$C exec -T mongo sh -c 'mongodump --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' > /root/tourvr-$(date +%F).archive.gz
docker run --rm -v tourvr-prod_media-data:/m -v /root:/b alpine tar czf /b/tourvr-media-$(date +%F).tgz -C /m .
```

---

## Comandos úteis na VM

```bash
cd /opt/tourvr
C="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod"
$C ps                                  # estado dos serviços
$C logs --tail 100 backend             # logs do backend (troque por web ou mongo)
$C restart backend                     # reinicia um serviço sem rebuild
$C exec backend python -m app.cli create-admin --email <email> --password <senha>
```

---

## Instalação do zero (já feita em 2026-11-26)

Para recriar o ambiente numa VM nova:

1. **Swap de 2 GB** (o build do app do visitante não cabe em 2 GB de RAM):
   `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon
   /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab`
2. **Docker:** `curl -fsSL https://get.docker.com | sh`
3. **Firewall:** `ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force
   enable`. Conferir também no painel do provedor se 80 e 443 estão liberadas.
4. **Código:** `git clone https://github.com/Tour-VR/quest-project.git /opt/tourvr`
5. **Segredos:** `cd /opt/tourvr && cp deploy/.env.prod.example deploy/.env.prod`; trocar
   cada `troque` por `openssl rand -hex 32`; `chmod 600 deploy/.env.prod`.
6. **Subir:** `bash scripts/deploy.sh`
7. **Primeiro administrador:** comando impresso no fim do script.

## Pendências de segurança da VM

- **SSH:** a VM aceita login de root por senha. Recomendado: criar usuário com chave
  pública, depois `PermitRootLogin no` e `PasswordAuthentication no` em
  `/etc/ssh/sshd_config.d/`, `systemctl reload ssh` — testando o novo acesso em outra
  janela antes de fechar a atual.
- **Domínio próprio:** `sslip.io` é serviço de terceiros. Para trocar, apontar `api.`,
  `painel.` e `tour.` para o IP, mudar `TOURVR_DOMAIN` em `deploy/.env.prod` e rodar
  `bash scripts/deploy.sh`. **A URL dos QR Codes muda**: imprimir as placas definitivas só
  depois dessa decisão.
