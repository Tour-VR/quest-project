# 021 — Navegação VR e encerramento

| | |
|---|---|
| **Status** | Validado |
| **Fase** | 4 — App do visitante, modo VR |
| **Depende de** | 018, 020 |
| **Dívidas atendidas** | DT-016 (conclusão) |
| **ADRs relacionadas** | ADR-0006, ADR-0007, ADR-0008 |
| **Artefatos afetados** | VR App · Orquestrador |
| **Planejado em** | 2026-11-05 |
| **Validado em** | 2026-11-05 por Ciro Macedo |
| **Executado em** | — |

---

## 1. Objetivo

Fechar o produto. O visitante remoto passa de um ponto a outro do campus pelas setas da
cena 360°, com o mouse, com o dedo ou com os controles do Quest 3, sem sair do VR. Este
plano também:

- escreve o roteiro de teste e de demonstração no Quest para alunos sem experiência;
- deixa toda a documentação refletindo o sistema pronto;
- marca a DT-016 como resolvida.

## 2. Leia antes de começar

- `docs/tasks/019-panoramas-e-conexoes.md`: seção 5 (conexões e `yaw`)
- `docs/tasks/020-cena-vr-360.md`: estrutura da cena, `yawToPosition`, calibração
- `docs/05-artefato-vr-app.md`
- `docs/00-visao-geral.md`
- `docs/implementacoes-futuras/DT-016-modelagem-dominio-turismo.md`

## 3. Estado esperado ao iniciar

- Plano 020 concluído: `src/modes/vr/` com `constants.ts`, `geometry.ts`
  (`yawToPosition`, `facingCenterRotationY`), hooks `usePanoramaTexture`,
  `useImmersiveVrSupport`, `useVrPoints`, cena em `scene/` (`VrCanvas`, `PanoramaSphere`,
  `InfoPanel3D`, `xrStore`), páginas `VrListPage` e `VrPointPage`, E2E `vr-scene.spec.ts`
  e fixture `e2e/fixtures/panorama-teste.jpg`.
- `PointPublicDetail.connections` com `target_slug`, `label`, `yaw_degrees`, `target_name`
  (plano 019).
- Plano 018 concluído: golden path completo da Fase 3 passando.

## 4. Escopo

**Dentro:**

- setas das conexões (*hotspots*) na cena, clicáveis com mouse, toque e controles do Quest;
- troca de ponto **sem encerrar a sessão VR** e sem recarregar a página;
- lista de conexões em HTML ("Ir para: ..."), para acessibilidade e para o E2E;
- E2E `@golden` de navegação entre dois pontos;
- `docs/10-roteiro-teste-quest.md`: teste manual e roteiro de demonstração;
- atualização final de `00-visao-geral`, `05-artefato-vr-app`, `01-arquitetura`,
  `docs/README.md`, DT-016 e o próximo passo do plano macro.

**Fora:**

- transição animada (esmaecimento) entre pontos: troca direta. Melhorias visuais ficam
  como dívida, se a turma quiser;
- roteiros como sequência ordenada de pontos: fora de escopo do plano macro (seção 8);
- mapa do campus, minimapa, áudio-guia: não previstos;
- publicação na Horizon Store: incompatível com WebXR (ADR-0006).

## 5. Decisões tomadas no planejamento

| Questão | Decisão | Motivo |
|---|---|---|
| Como manter a sessão VR ao trocar de ponto | `VrPointPage` **nunca desmonta o `<Canvas>`** depois da primeira carga: mantém o ponto e a textura atuais na tela até o próximo estar pronto, e só então troca | Desmontar o canvas encerra a sessão imersiva e tira o visitante do VR |
| Onde fica essa lógica | Hook `useVrTour(slug)` em `src/modes/vr/hooks/useVrTour.ts`, com estado `{ current, next, status }` | Lógica testável fora da cena |
| Navegação | `navigate(ROUTES.vrPoint(target), { replace: false })`; a URL acompanha o ponto | Voltar no navegador volta ao ponto anterior; link compartilhável |
| Erro ao carregar o próximo ponto | Fica no ponto atual e mostra aviso "Não foi possível abrir <nome>." por 4 s (HTML e painel 3D) | Visitante não cai numa tela preta |
| Posição da seta | `yawToPosition(yaw, HOTSPOT_DISTANCE = 8, HOTSPOT_HEIGHT = -1.2)`, girada com `facingCenterRotationY(yaw)` | Abaixo da linha dos olhos, perto o suficiente para mirar com o controle |
| Forma da seta | Disco (`circleGeometry`) branco semitransparente + `Text` com `target_name` acima; ao passar o ponteiro, aumenta 20% e fica opaco | Simples, legível, sem modelos 3D externos |
| Interação | `onClick` no `mesh` (a @react-three/xr 6 converte o raio do controle e o toque em eventos de ponteiro) | Uma única implementação para mouse, toque e controle |
| Visitas | Cada ponto alcançado pela navegação registra uma visita `vr` (`useRegisterVisit` já trata a troca de slug) | Métrica coerente com a visita presencial |
| Lista HTML | Painel "Ir para:" com um botão por conexão, ao lado do `PointHeader` | Acessível por teclado e leitor de tela; base do E2E |
| Testes da cena | Mesma regra do plano 020: `scene/` sem lógica e fora da cobertura; lógica em `geometry.ts` e hooks | jsdom não tem WebGL |

## 6. Passos de implementação

Passos 1 a 6 em `services/vr-app`, branch `plano/021-navegacao-vr-e-encerramento`.

### Passo 1 — Constantes

Em `src/modes/vr/constants.ts`:

```ts
export const HOTSPOT_DISTANCE = 8;
export const HOTSPOT_HEIGHT = -1.2;
export const HOTSPOT_RADIUS = 0.35;
export const HOTSPOT_HOVER_SCALE = 1.2;
export const HOTSPOT_IDLE_OPACITY = 0.6;
export const NAVIGATION_ERROR_MS = 4000;
```

### Passo 2 — Função pura de layout das setas

`src/modes/vr/hotspots.ts`:

```ts
export interface HotspotLayout {
  targetSlug: string;
  label: string;
  position: [number, number, number];
  rotationY: number;
}

export function layoutHotspots(connections: PointConnection[]): HotspotLayout[] {
  return connections.map((c) => ({
    targetSlug: c.target_slug,
    // o rotulo cadastrado pelo administrador vence; vazio usa o nome do destino
    label: c.label.trim() !== '' ? c.label : c.target_name,
    position: yawToPosition(c.yaw_degrees, HOTSPOT_DISTANCE, HOTSPOT_HEIGHT),
    rotationY: facingCenterRotationY(c.yaw_degrees),
  }));
}
```

### Passo 3 — Hook `useVrTour`

`src/modes/vr/hooks/useVrTour.ts`, combinando `fetchPublicPoint` e o carregamento de
textura do 020 (extraia de `usePanoramaTexture` uma função `loadPanoramaTexture(url)`
reaproveitável, sem duplicar código):

- primeira carga: `status: 'loading' | 'ready' | 'not-found' | 'no-panorama' | 'error'`;
- troca de `slug` com um ponto já na tela: mantém `current` (ponto + textura), carrega
  `next` em segundo plano; quando pronto, `current = next` e descarta a textura antiga;
  em falha, mantém `current` e expõe `navigationError: string | null` (some após
  `NAVIGATION_ERROR_MS`);
- descarta a textura atual ao desmontar;
- ignora respostas atrasadas de um slug já abandonado.

`VrPointPage.tsx` passa a usar `useVrTour` em vez de `usePoint` + `usePanoramaTexture`.
Os estados de carregamento e erro **de página inteira** só aparecem na primeira carga.

### Passo 4 — Setas na cena

`src/modes/vr/scene/Hotspot.tsx` (sem lógica além de estado de *hover*):

```tsx
export function Hotspot({ layout, onSelect }: HotspotProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={layout.position} rotation-y={layout.rotationY}>
      <mesh
        onClick={() => onSelect(layout.targetSlug)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? HOTSPOT_HOVER_SCALE : 1}
      >
        <circleGeometry args={[HOTSPOT_RADIUS, 32]} />
        <meshBasicMaterial transparent opacity={hovered ? 1 : HOTSPOT_IDLE_OPACITY} />
      </mesh>
      <Text position={[0, HOTSPOT_RADIUS * 2, 0]} fontSize={0.25} anchorX="center">
        {layout.label}
      </Text>
    </group>
  );
}
```

Mova `32` e `0.25` para `constants.ts` (`HOTSPOT_SEGMENTS`, `HOTSPOT_LABEL_SIZE`).

`VrCanvas` recebe `hotspots: HotspotLayout[]` e `onNavigate(slug)` e renderiza um
`Hotspot` para cada item. O `InfoPanel3D` passa a mostrar também `navigationError`,
quando houver.

### Passo 5 — Lista HTML de conexões

`src/modes/vr/ConnectionsList.tsx`: título "Ir para:", um `<button>` por conexão com o
rótulo, chamando o mesmo `onNavigate`. Sem conexões, o componente não renderiza nada.
Fica no painel HTML recolhível do 020, abaixo do `PointHeader`.

### Passo 6 — Testes unitários

| Arquivo | Teste | Verifica |
|---|---|---|
| `src/modes/vr/hotspots.test.ts` | layout | posição bate com `yawToPosition(…, 8, -1.2)`; rótulo personalizado vence `target_name`; rótulo vazio usa `target_name`; lista vazia → `[]` |
| `src/modes/vr/hooks/useVrTour.test.ts` | primeira carga | `loading → ready`; sem panorama → `no-panorama`; 404 → `not-found` |
| idem | troca de ponto | `current` permanece até o próximo carregar; depois troca e chama `dispose` na textura antiga |
| idem | falha na troca | mantém `current`; `navigationError` com o nome; limpa após o tempo (`vi.useFakeTimers`) |
| idem | resposta atrasada | resposta de slug abandonado é ignorada |
| `src/modes/vr/ConnectionsList.test.tsx` | botões | um por conexão; clique chama `onNavigate` com o slug; vazio não renderiza |
| `src/modes/vr/VrPointPage.test.tsx` (estender) | navegação | clicar em "Ir para" muda a URL para `/vr/<alvo>` (`MemoryRouter`) e o `VrCanvas` mockado **não** desmonta |

### Passo 7 — E2E de navegação

No orquestrador, branch `plano/021-navegacao-vr-e-encerramento`.

`e2e/tests/vr-navigation.spec.ts`:

```ts
test('@golden visitante remoto navega da biblioteca para a cantina em 360', async ({ page }) => {
  // via API: pontos A e B publicados, ambos com panorama-teste.jpg, conexao A->B (yaw 90, label 'Cantina')
  await page.goto(`${VISITOR_URL}/vr/${slugA}`);
  await expect(page.getByRole('heading', { name: nameA })).toBeVisible();
  await page.getByRole('button', { name: 'Cantina' }).click();
  await expect(page).toHaveURL(new RegExp(`/vr/${slugB}$`));
  await expect(page.getByRole('heading', { name: nameB })).toBeVisible();
  await expect(page.getByTestId('vr-canvas')).toBeVisible();
  await expect.poll(async () => (await getMetrics(token)).visits_by_mode.vr).toBe(before + 2);
});
```

### Passo 8 — Roteiro de teste e demonstração no Quest

**Arquivo novo:** `docs/10-roteiro-teste-quest.md`. Escreva para quem nunca usou o
óculos, em passos numerados e curtos:

1. **Antes de começar:** Quest 3 carregado (mais de 50%), mesma rede Wi-Fi do
   computador, pelo menos dois pontos publicados com panorama e uma conexão entre eles.
2. **Preparar o computador:** `docker compose up -d`; em outro terminal,
   `cd services/vr-app && npm run dev:https`; descobrir o IP (`ipconfig`, "Endereço IPv4");
   permitir o Node.js no firewall do Windows em redes privadas.
3. **No óculos:** ligar, ajustar a faixa e a lente, definir o limite (*guardian*)
   estacionário (a visita é feita parado ou sentado).
4. **Abrir o app:** menu (botão Meta) → **Navegador** → barra de endereço → digitar
   `https://<IP>:3001/vr` com o teclado virtual.
5. **Certificado:** "Sua conexão não é particular" → **Avançado** → **Continuar para
   <IP>** (uma vez por endereço).
6. **Entrar em VR:** escolher o ponto, tocar em **Entrar em VR**, permitir.
7. **Navegar:** apontar o controle direito para um círculo com nome de lugar e apertar o
   gatilho.
8. **Sair:** botão Meta → sair do modo imersivo; fechar a aba.
9. **Quadro de verificação** (tabela para o aluno marcar ✔/✖ e anotar): panorama nítido;
   centro da foto à frente; painel legível; setas na direção certa; troca de ponto sem
   sair do VR; nenhum enjoo ou travamento perceptível; visitas aparecem no painel.
10. **Problemas comuns:**

| Problema | Causa provável | O que fazer |
|---|---|---|
| Não abre a página | IP errado ou Wi-Fi diferente | Conferir o IP no computador; mesma rede |
| Botão "Entrar em VR" não aparece | Página em `http://` | Usar `https://` e aceitar o certificado |
| Tela preta no VR | Panorama maior que 4096 px | Reenviar a imagem em 4096×2048 |
| Seta no lugar errado | Ângulo cadastrado errado | Ajustar o ângulo da conexão no painel |
| Página não carrega no celular, mas carrega no PC | Firewall do Windows | Permitir Node.js em rede privada |

11. **Roteiro de demonstração (5 minutos, para banca ou visita):** abrir o painel e
   mostrar um ponto e seu QR Code impresso; escanear com o celular e mostrar a página do
   ponto; colocar o óculos em um voluntário em `/vr`, navegar entre dois pontos; voltar
   ao painel e mostrar as visitas `ar` e `vr` nas métricas.

Inclua o arquivo no índice de `docs/README.md` (árvore "Como esta base está organizada").

### Passo 9 — Documentação final do produto

- `docs/00-visao-geral.md`: "Estado atual" passa a descrever o sistema completo (painel com
  pontos, mídia, QR e métricas; app do visitante com modo AR e modo VR); atualizar os
  números da tabela de métricas do código (testes no backend, frontend e vr-app, endpoints)
  **contando de verdade** (`pytest --collect-only -q | tail -1`, `vitest list` ou a saída
  do `test`, e as rotas do `/openapi.json`); "Direção definida" passa a "Produto entregue"
  e aponta para o roteiro do passo 8.
- `docs/05-artefato-vr-app.md`: status "✅ Implementado"; remover a seção "Por que isso
  importa" (descrevia o repositório vazio) e "Pendências antes da implementação"; árvore
  real de `src/`; navegação VR e decisão de manter o canvas montado.
- `docs/01-arquitetura.md`: diagrama de topologia com `vr-app` e os fluxos AR e VR.
- `docs/implementacoes-futuras/DT-016-modelagem-dominio-turismo.md`: Status `Resolvida`,
  com a lista dos planos 009, 010, 012 a 021 que a resolveram; atualizar também o índice
  `docs/implementacoes-futuras/README.md`.
- `docs/tasks/000-visao-macro-opcao-b.md`, seção 9 "Próximo passo": "As cinco fases foram
  entregues. Próximas frentes possíveis estão na seção 8 (fora de escopo) e em
  `implementacoes-futuras/`."

## 7. Testes

```bash
cd services/vr-app && npm run lint && npm run format:check && npm run test:coverage && npm run build
cd ../.. && bash scripts/validate.sh
```

Teste manual no Quest 3 seguindo `docs/10-roteiro-teste-quest.md`, com o quadro de
verificação preenchido e colado no PR do orquestrador. Se a turma não tiver acesso ao
óculos no momento da execução, registre isso no PR. O orientador decide se o merge espera
o teste.

## 8. Documentação a atualizar

- [ ] `docs/10-roteiro-teste-quest.md`: novo (passo 8)
- [ ] `docs/README.md`: índice com o novo documento
- [ ] `docs/00-visao-geral.md`, `docs/05-artefato-vr-app.md`, `docs/01-arquitetura.md`: passo 9
- [ ] `docs/implementacoes-futuras/DT-016-...md` e `README.md` do diretório: DT-016 resolvida
- [ ] `docs/tasks/000-visao-macro-opcao-b.md`: seção 9

## 9. Critérios de aceite

- [ ] Setas aparecem na direção cadastrada (90° à direita, -90° à esquerda, 180° atrás)
- [ ] Clicar ou tocar numa seta leva ao ponto vizinho; a URL muda para `/vr/<alvo>`
- [ ] No Quest 3, apontar o controle e apertar o gatilho troca de ponto **sem sair do VR**
- [ ] Falha ao abrir o vizinho mantém o ponto atual e mostra aviso
- [ ] Lista "Ir para:" funciona com teclado
- [ ] Cada ponto visitado conta uma visita `vr`
- [ ] E2E `@golden` de navegação passando, junto com todos os golden paths anteriores
- [ ] Roteiro do Quest escrito e, se houver óculos disponível, quadro de verificação preenchido no PR
- [ ] Documentação final coerente com o código; DT-016 resolvida
- [ ] `bash scripts/validate.sh` passando

## 10. Commits esperados

`services/vr-app`:

```
feat(vr): adiciona layout das setas a partir das conexoes
feat(vr): troca de ponto sem desmontar a cena com useVrTour
feat(vr): adiciona setas clicaveis na cena e lista ir para
```

Orquestrador:

```
test(e2e): adiciona o golden path de navegacao entre pontos em 360
docs: adiciona o roteiro de teste e demonstracao no quest 3
docs: atualiza a visao geral e os artefatos para o produto entregue
docs: marca DT-016 como resolvida
```

## 11. Riscos e pontos de atenção

- **Sessão VR encerrando na troca.** Se o Quest sair do VR ao clicar numa seta, alguma
  parte da árvore está desmontando o `<Canvas>`: provavelmente o estado de carregamento
  de página inteira. O teste unitário "VrCanvas não desmonta" existe para pegar isso
  antes do óculos.
- **Seta não responde ao controle.** Confira que o `onClick` está no `mesh` (não no
  `group`) e que nenhum objeto transparente maior está na frente. A esfera do panorama
  não deve ter `onClick`.
- **Seta do lado oposto.** Não mude a fórmula: refaça a calibração do plano 020 (passo 9)
  e confira o ângulo cadastrado no painel.
- **Números da visão geral.** Não copie números de documentos antigos; conte-os.

## 12. Verificação pelo aluno

1. No painel, garanta dois pontos publicados com panorama, por exemplo Biblioteca e
   Cantina, e uma conexão da Biblioteca para a Cantina com ângulo 90.
2. No computador, abra `http://localhost:3001/vr/<slug-da-biblioteca>`. Arraste para a
   direita até ver o círculo "Cantina" e clique: você está na Cantina, e o endereço mudou.
3. Use o botão **Voltar** do navegador: você volta à Biblioteca.
4. Use a lista **Ir para:** e confira que ela leva ao mesmo lugar.
5. **No Meta Quest 3:** siga `docs/10-roteiro-teste-quest.md` do começo ao fim e
   preencha o quadro de verificação. Mande uma foto do quadro no grupo.
6. No painel, as métricas mostram visitas `vr` para os dois pontos.
7. Faça a demonstração de 5 minutos do roteiro para um colega que não participou do
   projeto. Se ele conseguir navegar sozinho no óculos, o produto está entregue.

---

## Prompt de delegação

Cole no Claude Code, na pasta `quest-project`, trocando o nome:

```text
Você é a sessão de EXECUÇÃO do projeto TourVR.
Execute o plano docs/tasks/021-navegacao-vr-e-encerramento.md.
Antes de qualquer ação, leia docs/tasks/protocolo-execucao.md e siga o "Prompt 1 — EXECUTAR" etapa por etapa.
Meu nome, para registrar no plano: <SEU NOME>
```
