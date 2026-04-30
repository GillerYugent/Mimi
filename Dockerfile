# Multi-stage build для фронтенда Mimi.
# Stage 1: ставим зависимости и собираем production-бандл через Vite.
# Stage 2: лёгкий nginx, отдающий /dist + try_files для client-side routing.
#
# Build:
#   docker build -t mimi-frontend .
# Run (standalone):
#   docker run --rm -p 5173:80 mimi-frontend
#
# В docker-compose сервис frontend сидит за gateway'ем (NGINX), который
# проксирует / → frontend и /api/* → микросервисы Go.

FROM node:20-alpine AS builder
WORKDIR /src

# Кэшируем зависимости в отдельный слой.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
COPY public ./public

RUN npm run build

FROM nginx:1.27-alpine
COPY docker/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /src/dist /usr/share/nginx/html

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz || exit 1

EXPOSE 80
