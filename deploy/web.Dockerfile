# Imagem web de producao: builds estaticos do painel e do app do visitante servidos pelo Caddy,
# que tambem faz o HTTPS e o proxy da API (ADR-0010). Contexto de build: raiz do orquestrador.

# Estagio 1: painel administrativo
FROM node:22-alpine AS painel
WORKDIR /app
COPY services/frontend/package.json services/frontend/package-lock.json ./
RUN npm ci
COPY services/frontend/ ./
# Variaveis VITE_* sao lidas no build: a URL da API e a dos QR Codes ficam embutidas no bundle.
ARG VITE_API_URL
ARG VITE_VISITOR_APP_URL
ENV VITE_API_URL=$VITE_API_URL VITE_VISITOR_APP_URL=$VITE_VISITOR_APP_URL
RUN npm run build

# Estagio 2: app do visitante (chama /api e /media por caminho relativo)
FROM node:22-alpine AS tour
WORKDIR /app
COPY services/vr-app/package.json services/vr-app/package-lock.json ./
RUN npm ci
COPY services/vr-app/ ./
RUN npm run build

# Estagio final: Caddy
FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=painel /app/dist /srv/painel
COPY --from=tour /app/dist /srv/tour
