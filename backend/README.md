# Mimi Backend

Микросервисный backend платформы Mimi (практические работы №5–8).

## Архитектура

- **9 Go-микросервисов** (один на домен)
- **PostgreSQL 15** — по одной базе на сервис (Database per Service), кроме `users` — общая для `auth-service` и `users-service` (как на диаграмме из практики 7)
- **Redis 7** — кэш + Pub/Sub + whitelist refresh-токенов
- **NGINX** — API Gateway (маршрутизация, SSL-терминация, CORS)
- **Docker Compose** — оркестрация всей системы

## Сервисы

| Сервис | Статус | Домен |
| --- | --- | --- |
| auth-service | ✅ готов | Регистрация, вход, JWT access/refresh, bcrypt, профиль |
| users-service | ✅ готов | My Space, публичные профили, поиск по email, batch-lookup |
| projects-service | ✅ готов | CRUD проектов, архив/восстановление, Redis-кэш списка (TTL 60с) |
| tasks-service | ✅ готов | CRUD задач, подзадачи, метки, фильтры, stats, Pub/Sub событий |
| docs-service | ⏳ | Страницы, блоки, вложенность, история |
| boards-service | ⏳ | Канвасы (JSONB) |
| teams-service | ⏳ | Команды, роли, права |
| git-service | ⏳ | OAuth GitHub/GitLab, коммиты, PR |
| notifications-service | ⏳ | SSE + Redis Pub/Sub |

## Быстрый старт

```bash
cp .env.example .env      # при необходимости поменяйте JWT_SECRET
docker compose up -d --build
curl http://localhost:8080/healthz
```

Gateway слушает на `:8080`. Запрос на регистрацию:

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Max","email":"max@mimi.dev","password":"secret123"}'
```

Ответ — `201 Created` с `access_token`, `refresh_token` и данными пользователя.

## Локальная разработка без Docker

```bash
# Поднять только Postgres + Redis из compose:
docker compose up -d postgres-users redis

export DATABASE_URL=postgres://mimi:mimi@localhost:5432/mimi_users?sslmode=disable
export REDIS_URL=redis://localhost:6379/0
export JWT_SECRET=$(openssl rand -hex 32)

make run-auth-service
```

## Структура кода

```
backend/
├── cmd/<service>/main.go         — точка входа каждого микросервиса
├── services/<service>/           — handlers, service, repo, domain
├── internal/                     — общие пакеты (НЕ экспортируемые наружу)
│   ├── auth/                     — JWT, bcrypt, middleware
│   ├── config/                   — env-конфиг
│   ├── db/                       — pgxpool + миграции
│   ├── cache/                    — Redis-клиент
│   ├── httpx/                    — JSON-ответы, middleware, healthchecks
│   └── log/                      — slog-логгер
├── migrations/<service>/         — *.sql миграции (автоматически применяются)
├── docker/service.Dockerfile     — один Dockerfile на все сервисы
├── docker-compose.yml
├── nginx/nginx.conf              — конфигурация API Gateway
└── Makefile
```

## Соответствие ТЗ (практика 7, 8)

- JWT: access 15 мин + refresh 7 дней, HS256, ротация refresh в Redis
- bcrypt cost ≥ 12
- Health `/healthz` + readiness `/readyz` на каждом сервисе
- Автоматическое применение миграций при старте
- Docker restart policy `unless-stopped` + healthcheck (соответствует НФТ «автоперезапуск ≤ 30 с»)
- Нормализация до 3НФ, первичные ключи UUID (см. `001_init.sql` каждого сервиса)
