# 09 — Glossário

Vocabulário comum do projeto. Serve para alinhar a equipe e para desambiguar termos em
sessões de planejamento e de execução.

## Produto e domínio

| Termo | Significado no TourVR |
|---|---|
| **TourVR** | Nome do sistema como um todo — os quatro repositórios e o produto final. |
| **OculosVR** | Nome herdado do MVP, ainda presente no código (`oculosvr_db`, `oculosvr-frontend`, `@OculosVR:token`, título do painel). É o **mesmo produto**; a renomeação para TourVR não foi concluída. |
| **Painel administrativo** | O `frontend` web, usado por administradores para gerenciar o conteúdo — não é a experiência do visitante. |
| **Aplicação VR** | O `vr-app`, executado no headset. É o produto entregue ao usuário final. Ainda não existe. |
| **Roteiro** *(proposto)* | Sequência curada de pontos turísticos que compõem uma visita. Ainda não modelado. |
| **Ponto de interesse** *(proposto)* | Local específico dentro de um roteiro, com mídia e informação associadas. Ainda não modelado. |
| **Sessão de uso** *(proposto)* | Registro de uma visita realizada por um usuário no headset. Contabilizada de forma fictícia no dashboard atual. |

## Infraestrutura e repositórios

| Termo | Significado |
|---|---|
| **Orquestrador** | O repositório `quest-project`: agrega submódulos, hospeda `docs/` e a automação. |
| **Submódulo** | Repositório Git aninhado em `services/`, fixado em um commit específico pelo orquestrador. |
| **Ponteiro do submódulo** | O commit exato que o orquestrador registra para cada submódulo. Atualizá-lo é um commit no orquestrador. |
| **Detached HEAD** | Estado em que um submódulo fica após `git submodule update`: aponta para um commit, não para uma branch. Commitar nesse estado leva à perda do trabalho. Ver [07-convencoes.md](07-convencoes.md). |
| **Artefato** | Cada unidade de sistema documentada na raiz de `docs/` — orquestrador, backend, frontend, vr-app. |

## Processo de trabalho

| Termo | Significado |
|---|---|
| **DT-NNN** | Identificador de dívida técnica em `docs/implementacoes-futuras/`. |
| **ADR** | *Architecture Decision Record* — decisão arquitetural registrada em `docs/08-decisoes-arquiteturais.md`. |
| **Plano** | Documento em `docs/tasks/NNN-slug.md` descrevendo uma implementação em detalhe suficiente para ser executada sem redecidir nada. |
| **Prompt de delegação** | Bloco final de um plano validado, copiado para iniciar a sessão de execução. |
| **Sessão de planejamento** | Sessão que analisa, decide e escreve o plano. Não escreve código de produção. |
| **Sessão de execução** | Sessão que recebe um plano validado e o implementa. Não redecide arquitetura. |

## Stack — backend

| Termo | Significado |
|---|---|
| **FastAPI** | Framework web Python assíncrono usado no backend. |
| **ASGI / Uvicorn** | Interface e servidor assíncronos que executam a aplicação FastAPI. |
| **Lifespan** | Gancho de ciclo de vida do FastAPI onde a conexão com o MongoDB é aberta e fechada. |
| **Pydantic** | Biblioteca de validação de dados; define os schemas de entrada e saída da API. |
| **Schema × Model** | *Schema* é o contrato HTTP (`app/schemas/`); *Model* é o documento persistido (`app/models/`). Não são a mesma coisa. |
| **Repository** | Camada que executa queries no MongoDB, sem regra de negócio. |
| **Service** | Camada de regra de negócio; levanta exceções de domínio, nunca `HTTPException`. |
| **Exceção de domínio** | `UserInputError`, `UserConflictError`, `AuthenticationError`, `UserNotFoundError` — traduzidas em códigos HTTP pelas rotas. |
| **JWT** | *JSON Web Token* — token assinado que carrega a identidade do usuário. |
| **bcrypt / passlib** | Algoritmo e biblioteca de hash de senha. |

## Stack — frontend

| Termo | Significado |
|---|---|
| **SPA** | *Single Page Application* — a navegação ocorre no cliente, sem recarregar a página. |
| **Vite** | Ferramenta de build e servidor de desenvolvimento do frontend. |
| **Context / `useAuth`** | Mecanismo React que mantém o estado de sessão global; único ponto de acesso à autenticação. |
| **Interceptor** | Gancho do Axios que altera requisições ou respostas. Existe o de request (injeta o token); falta o de response (tratar 401). |
| **Guard de rota** | `ProtectedRoute` — impede acesso a rotas sem sessão válida. |
| **Tailwind** | Framework CSS por classes utilitárias aplicadas diretamente no JSX. |

## Realidade virtual e aumentada

| Termo | Significado |
|---|---|
| **Quest 3** | Headset da Meta, plataforma alvo do projeto. Roda Android; aplicativos são distribuídos como APK. |
| **RV / VR** | Realidade virtual — imersão total, o mundo real é substituído. |
| **RA / AR** | Realidade aumentada — informação virtual sobreposta ao mundo real. |
| **Passthrough** | Recurso do Quest 3 que exibe o ambiente real através das câmeras; base para AR no dispositivo. |
| **OpenXR** | Padrão aberto de API para RV/RA, suportado pelo Quest e pelos principais motores. |
| **WebXR** | API que permite experiências de RV/RA dentro do navegador — alternativa a motores nativos. |
| **Vídeo 360°** | Vídeo esférico que permite olhar em qualquer direção a partir de um ponto fixo. |
| **Fotogrametria** | Reconstrução de modelos 3D a partir de fotografias de um local real. |
| **APK** | Pacote de aplicativo Android; formato de distribuição para o Quest 3. |
| **Sideload** | Instalação de um APK no headset sem passar pela loja oficial — caminho usual em desenvolvimento e em projetos acadêmicos. |
