# Mimi

Веб-платформа **Mimi** — рабочее пространство для разработчиков: задачи, документы, канвасы, команды и Git-интеграция в одном месте.

Полная реализация по практическим работам №1–14 (РТУ МИРЭА, дисциплина «Системная и программная инженерия»). Поднимается одной командой `docker compose up`.

## TL;DR

```bash
git clone <repo>
cd Mimi
cp backend/.env.example .env       # при необходимости поменяйте JWT_SECRET
docker compose up -d --build       # поднять весь стек
open http://localhost:8080         # фронтенд + API
```

После старта:

- `http://localhost:8080` — приложение (SPA на React)
- `http://localhost:8080/api/*` — REST API (через gateway NGINX)
- `http://localhost:8080/api/notifications/stream` — SSE для уведомлений

## Архитектура

Микросервисы по образцу ТЗ из практики 7:

```
                ┌────────────────────────────────────────────────┐
   браузер ──►  │  NGINX gateway (:8080)                         │
                │   /          → frontend (React SPA, nginx)     │
                │   /api/auth  → auth-service                    │
                │   /api/users → users-service                   │
                │   /api/tasks → tasks-service ─publish─┐        │
                │   /api/docs  → docs-service           │        │
                │   /api/boards→ boards-service         │        │
                │   /api/teams,/api/invitations → teams │        │
                │   /api/git   → git-service            │        │
                │   /api/notifications/* → notifications│ Pub/Sub│
                │   /api/notifications/stream → SSE ◄───┘        │
                └─────────────┬──────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
   PostgreSQL × 8         Redis 7              External APIs
   (по 1 на сервис)     (cache + Pub/Sub)     (GitHub/GitLab)
```

| Контейнер | Что | Stack |
| --- | --- | --- |
| `frontend` | SPA, отдаётся через NGINX | React 18 + TS + Vite + Tailwind + Zustand |
| `gateway` | API Gateway, маршрутизация, CORS | NGINX 1.27 |
| `auth-service` | JWT, регистрация, профиль | Go, gorilla/mux, bcrypt, jwt/v5 |
| `users-service` | Публичные профили, My Space | Go, pgx/v5 |
| `projects-service` | Проекты + Redis-кэш списка | Go |
| `tasks-service` | Kanban + Pub/Sub событий | Go, redis Pub/Sub |
| `docs-service` | Страницы + версии | Go, JSONB |
| `boards-service` | Канвасы (JSONB elements) | Go |
| `teams-service` | Команды, роли, приглашения | Go |
| `git-service` | GitHub/GitLab REST | Go |
| `notifications-service` | SSE + Pub/Sub consumer | Go |
| `redis` | Cache + Pub/Sub | Redis 7 |
| `postgres-{users,projects,tasks,docs,boards,teams,git,notifications}` | Database per Service | Postgres 15 |

## Что реализовано (краткий перечень)

- **Auth.** Регистрация, вход, refresh с ротацией, smena пароля. JWT access 15 мин + refresh 7 дней. bcrypt cost 12.
- **Dashboard + Sidebar.** Все проекты пользователя со статистикой задач. Создание проекта → переход в workspace.
- **Проекты.** CRUD + архив/восстановление + удаление с каскадом. Redis-кэш TTL 60 с (НФТ).
- **Kanban.** 5 колонок (Backlog → To Do → In Progress → Review → Done), drag-and-drop, подзадачи (FK ON DELETE CASCADE), метки, приоритеты, дедлайны, исполнители. Фильтрация в реальном времени.
- **Docs.** Notion-style блочный редактор (H1–H3, списки, чек-листы, цитаты, код, markdown-сокращения), вложенные подстраницы, **debounced autosave** с индикатором, история версий с восстановлением, поиск.
- **Canvas (Miro-style).** Pan + smooth wheel-zoom вокруг курсора, marquee selection, **resize-handles в углах**, **anchored arrows** (стрелки приклеиваются к границам элементов, не к центру), Spacebar+drag для пана, hotkeys V/B/S/T/M/A.
- **My Space.** Изолированное личное пространство (notes / tasks / canvases) через таблицу `my_spaces`.
- **Команды.** 4 таблицы (teams, roles, team_members, invitations), preset-роли (Backend/Frontend/Designer/QA), произвольные роли с настраиваемыми правами (canViewDocs, canEditDocs, …), приглашение по email с accept/decline.
- **Git.** Подключение GitHub/GitLab по PAT, реальный fetch коммитов и Pull Requests из API, Redis-кэш 60 с, ссылки в карточках.
- **Notifications.** Redis Pub/Sub consumer (`mimi:events:tasks`) → запись в БД → SSE-стрим клиенту. Heartbeat 15 с, графейсли через NGINX (`proxy_buffering off`).
- **Архив + Settings + Notifications page** — стандартные страницы для соответствующего функционала.

## Тесты

См. [tests/README.md](tests/README.md). Кратко:

```bash
# Go unit-тесты
cd backend && go test ./...

# API-тесты (Postman / Newman)
docker compose up -d
newman run tests/postman/mimi.postman_collection.json --env-var baseUrl=http://localhost:8080

# Нагрузочный (k6)
k6 run --env BASE_URL=http://localhost:8080 tests/k6/load.js
```

## Соответствие практикам

Полный аудит — в [COMPARISON.md](COMPARISON.md).

Кратко: всё функциональное ядро (9 микросервисов, 13 таблиц БД, полнофункциональный фронт, Docker, миграции, тесты) реализовано. Не реализовано — то, что в практиках было процессным/организационным (распределение ролей в команде, BPMN-диаграммы, Jira-доска) или из категории «производственная инфраструктура» (Grafana+Prometheus, Playwright/BrowserStack, automated backup) — список в `COMPARISON.md`.

## Структура репо

```
Mimi/
├── docker-compose.yml          # корневой compose: всё одной командой
├── Dockerfile                  # фронтенд (multi-stage Node → nginx)
├── docker/frontend.conf        # nginx-конфиг внутри frontend-контейнера
├── COMPARISON.md               # таблица соответствия практикам 1–14
├── README.md
│
├── src/                        # фронтенд (React + TS)
│   ├── api/                    # клиент к 9 микросервисам + JWT/refresh
│   ├── components/             # UI: layout, tasks, docs, boards, team, git, ...
│   ├── pages/                  # маршруты
│   ├── store/                  # Zustand-сторы (cache + actions)
│   └── types/                  # доменные типы (зеркалят backend domain)
│
├── backend/                    # Go-микросервисы
│   ├── go.mod / go.sum
│   ├── Makefile
│   ├── README.md
│   ├── docker/service.Dockerfile  # один Dockerfile на 9 сервисов
│   ├── nginx/nginx.conf        # gateway-конфиг (маршрутизация)
│   ├── cmd/<service>/main.go   # точки входа
│   ├── services/<service>/     # domain / repo / service / handler
│   ├── internal/               # shared: auth, db, cache, httpx, log, events, gitprovider
│   └── migrations/<service>/   # *.sql, автоприменяются на старте
│
└── tests/
    ├── README.md
    ├── postman/mimi.postman_collection.json   # TC-1…TC-10
    └── k6/load.js               # нагрузочный по НФТ
```

## Локальная разработка без Docker

```bash
# 1) Поднять только инфру
docker compose up -d redis postgres-users postgres-projects postgres-tasks \
                    postgres-docs postgres-boards postgres-teams postgres-git \
                    postgres-notifications

# 2) Поднять выбранный сервис локально (пример с auth-service)
cd backend
export DATABASE_URL=postgres://mimi:mimi@localhost:5432/mimi_users?sslmode=disable
export REDIS_URL=redis://localhost:6379/0
export JWT_SECRET=$(openssl rand -hex 32)
go run ./cmd/auth-service

# 3) Фронт в режиме dev — Vite proxy /api/* на gateway:8080
npm install
npm run dev   # http://localhost:5173
```
