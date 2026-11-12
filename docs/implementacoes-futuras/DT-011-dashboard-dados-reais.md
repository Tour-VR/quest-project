# DT-011 — Dashboard exibe métricas fictícias e menu sem destino

| | |
|---|---|
| **Status** | Parcial — endpoint de métricas pronto (plano 010); consumo no painel pendente (plano 015) |
| **Prioridade** | P2 |
| **Esforço** | Médio |
| **Artefato** | Frontend, Backend |
| **Registrada em** | 2026-08-20 |
| **Depende de** | DT-016 (as métricas dependem do domínio existir) |

## Contexto

O `Dashboard.tsx` apresenta três cartões de métrica e três itens de navegação lateral. As
métricas são constantes literais no código e os itens de menu são `div` sem rota. Apenas o
nome do usuário e o bloco JSON de `/users/me` são reais.

## Evidência

`src/pages/Dashboard.tsx`:

```tsx
const navigationItems = [
  { label: 'Dashboard', icon: Box, isActive: true },
  { label: 'Usuarios', icon: UserIcon, isActive: false },
  { label: 'Configuracoes VR', icon: Settings, isActive: false },
];

const dashboardMetrics = [
  { label: 'Usuarios Ativos', value: '124' },
  { label: 'Ambientes VR', value: '12' },
  { label: 'Sessoes Hoje', value: '89' },
];
```

Os itens de navegação são renderizados como `<div>`, sem `onClick`, sem `Link` e sem rota
correspondente em `App.tsx`. Não existe endpoint de métricas no backend, nem entidade de
ambiente VR ou de sessão em lugar algum do sistema.

## Impacto

- **Risco de comunicação.** Uma demonstração ou banca pode interpretar os números como
  dados reais do sistema. O painel afirma que existem 12 ambientes VR quando o conceito de
  ambiente VR não foi sequer modelado.
- Menu que não navega é defeito perceptível em qualquer avaliação de usabilidade.
- Cria expectativa de funcionalidade inexistente para quem for evoluir o código.

## Proposta

**Imediato — honestidade da interface (esforço baixo)**

1. Marcar visualmente os cartões como exemplo — rótulo "dados de exemplo" ou estado vazio
   com "sem dados disponíveis".
2. Desabilitar visualmente os itens de menu sem destino, ou removê-los até existirem.

**Quando o domínio existir (depende de DT-016)**

3. ✅ Criar `GET /admin/metrics/overview` no backend, protegido por papel de administrador
   ([DT-008](DT-008-autorizacao-por-papel.md)), agregando contagens reais — **feito no
   plano 010** (`services/backend/app/api/v1/routes/admin_metrics.py`; contrato em
   [06-contrato-api.md](../06-contrato-api.md#get-adminmetricsoverview)).
4. Consumir o endpoint no `Dashboard`, com estados de carregando, erro e vazio.
5. Implementar as páginas "Usuários" ([DT-015](DT-015-gestao-usuarios-no-painel.md)) e
   "Configurações VR" com rotas reais.

## Critérios de aceite

- [ ] Nenhum número exibido no painel pode ser confundido com dado real enquanto não for
- [ ] Itens de menu ou navegam, ou estão visivelmente desabilitados
- [ ] Após DT-016: cartões refletem contagens reais, com tratamento de carregando e erro

## Notas

**Andamento (2026-11-11, plano 010).** O backend já entrega contagens reais: total de
pontos e de publicados, total de visitas, visitas dos últimos 7 dias, visitas por modo
(`ar`/`vr`) e os 5 pontos mais visitados. Falta o painel consumir o endpoint (plano 015).

A etapa imediata custa minutos e elimina o risco de má interpretação em apresentação. Não
esperar pelo domínio para executá-la.
