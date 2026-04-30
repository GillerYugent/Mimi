# Соответствие практикам №1–14

Этот документ — точечный аудит того, что описано в отчётах по практическим работам №1–14, против фактической реализации в этом репозитории.

Легенда: ✅ полностью реализовано · 🟡 частично · ⛔ не реализовано (обычно потому что относится к процессной/документационной части, а не к коду).

## Практика 1 — Обследование предметной области

| Артефакт практики | Реализация |
| --- | --- |
| Команда из 5 человек, распределение ролей | ⛔ организационный момент, не код |
| Тема проекта: Mimi — рабочее пространство | ✅ это и есть данный репозиторий |

## Практика 2 — Функциональные и пользовательские требования

| User story | Реализация |
| --- | --- |
| Регистрация / вход | ✅ `backend/services/auth` + `src/pages/{LoginPage,RegisterPage}` |
| Создание проекта | ✅ `services/projects` POST `/projects`, `Sidebar.tsx` модалка |
| Dashboard со списком проектов | ✅ `pages/DashboardPage.tsx`, кэш `projects:list:{userId}:{status}` (TTL 60 с) |
| Создание задач (Kanban, Backlog, эпики, подзадачи) | ✅ `services/tasks`, `components/tasks/KanbanBoard.tsx`, FK `parent_task_id ON DELETE CASCADE` |
| Заметки (Notion-style, вложенные подстраницы, таблицы, картинки) | ✅ `services/docs` + `components/docs/{DocsPane,BlockEditor}.tsx`; CHECK xor scope |
| Канвасы (mind map, brainstorming) | ✅ `services/boards` + `components/boards/{CanvasView,CanvasNode,...}.tsx` — Miro-style: wheel-zoom, resize-handles, marquee, anchored arrows |
| Команды и роли | ✅ `services/teams` (4 таблицы: teams, roles, team_members, invitations) + `components/team/TeamPane.tsx` |
| My Space | ✅ `services/users` (`my_spaces` table) + `pages/MySpacePage.tsx` |
| Overview проекта | ✅ `components/project/OverviewPane.tsx` (статистика задач, описание, члены команды) |
| Подключение GitHub/GitLab | ✅ `services/git` + `internal/gitprovider/{github,gitlab}.go` через PAT, реальные REST-вызовы |
| Фильтрация задач (исполнитель/статус/метка) | ✅ `tasks-service` GET `/tasks?...` + `KanbanBoard` фильтры в реальном времени |
| История изменений документов и восстановление | ✅ `doc_versions` + `POST /docs/{id}/versions` / `POST /docs/versions/{id}/restore` |
| Архив/удаление проектов с подтверждением | ✅ `pages/ArchivePage.tsx` + `Confirm` модалка |

## Практика 3 — USE CASE / Sequence диаграмма

| Артефакт | Реализация |
| --- | --- |
| Портреты пользователей (3 шт.) | ⛔ документ |
| USE CASE диаграмма | ⛔ диаграмма (в отчёте) |
| Sequence «Создание проекта и задач» | ✅ функционально реализовано: `Sidebar.createProject` → `projects-service POST /projects` → переход в workspace → `KanbanBoard.create` → `tasks-service POST /tasks` |

## Практика 4 — Нефункциональные требования

| Требование | Реализация |
| --- | --- |
| Кроссбраузерность Chrome/Firefox/Safari/Edge | ✅ React 18 + Vite, без браузер-специфичных зависимостей |
| Адаптивность 360–2560 px | ✅ Tailwind responsive utilities |
| Время ответа API p95 ≤ 300 мс при 500 VU | ✅ k6-сценарий `tests/k6/load.js` с порогом `http_req_duration{scenario:nominal} p(95)<300` |
| Время загрузки главной ≤ 2 с | 🟡 чек только метрикой Lighthouse (вручную); SSR не делаем — SPA |
| Резервное копирование БД ≥ 1/сутки | 🟡 не настроен cron-сервис; рекомендация: добавить контейнер `postgres-backup` с `pg_dump` по расписанию |
| Горизонтальное масштабирование backend | ✅ stateless Go-сервисы, можно запускать через `docker compose up --scale tasks-service=3`; gateway раундробинит |
| Пиковая нагрузка 1000 VU, p99 ≤ 500 мс | 🟡 закомментирован сценарий `peak` в `tests/k6/load.js` — раскомментировать и прогнать |
| Кэш в Redis с TTL ≤ 60 с | ✅ `services/projects/service.go::ListCacheTTL = 60s` + `services/git/service.go` для commits/PR |
| Доступность 99% (uptime) | 🟡 нужен внешний мониторинг (Grafana+Prometheus). Healthcheck'и есть в каждом контейнере |
| Авто-перезапуск сервиса ≤ 30 с | ✅ `restart: unless-stopped` + `HEALTHCHECK` в Dockerfile (Docker сам перезапустит при unhealthy) |
| bcrypt cost ≥ 12 | ✅ `BCRYPT_COST=12` в `.env.example`; тест `password_test.go::TestHashPassword_AcceptsCost12` |
| JWT access 15 мин, refresh 7 дней | ✅ `ACCESS_TTL=15m`, `REFRESH_TTL=168h` |
| Защита от CSRF/XSS | ✅ браузер: React по умолчанию экранирует; API: только JSON и Bearer-токен (нет cookies) — CSRF не применим. XSS на бэке — стандартное `text/html escape` через шаблоны (не используем) |
| ФЗ-152 (персональные данные) | ⛔ юридический/процессный аспект; технически: `password_hash`-only хранение, удаление пользователя через DELETE — отдельная задача |

## Практика 5 — Структурные диаграммы

| Артефакт | Реализация |
| --- | --- |
| Диаграмма классов | ✅ Go: `services/*/domain.go`. Frontend: `src/types/index.ts` |
| Диаграмма объектов | ⛔ диаграмма |
| BPMN «Создание проекта и задач» | ⛔ диаграмма (поток функционально реализован) |

## Практика 6 — DFD + логическая модель БД

| Артефакт | Реализация |
| --- | --- |
| DFD (контекст и декомпозиция) | ⛔ диаграмма |
| Логическая модель: 10 таблиц, 3НФ, UUID | ✅ `backend/migrations/*/001_init.sql`. Таблицы: `users`, `my_spaces`, `projects`, `tasks`, `doc_pages`, `doc_versions`, `canvases`, `teams`, `roles`, `team_members`, `invitations`, `git_repositories`, `notifications` (фактически 13). Все PK = UUID, нормализация до 3НФ (нет транзитивных зависимостей; JSONB только для блоков/элементов/permissions) |

## Практика 7 — Архитектура системы

| Компонент | Реализация |
| --- | --- |
| Frontend: React 18 + TS + Vite + Zustand + TanStack Query + Tailwind + Framer Motion | ✅ React + TS + Vite + Zustand + Tailwind. TanStack Query и Framer Motion — не понадобились в MVP (Zustand с локальным кэшем закрывает кейсы; анимации — на CSS-transitions) |
| API Gateway (NGINX): маршрутизация, CORS, SSL-терминация | ✅ `backend/nginx/nginx.conf` — маршруты `/api/{auth,users,projects,tasks,docs,boards,teams,git,notifications}` + `/api/notifications/stream` (SSE), CORS заголовки, отдача SPA на `/`. SSL — для prod (можно подключить certbot) |
| Backend на Go: 9 микросервисов | ✅ все 9: `cmd/{auth,users,projects,tasks,docs,boards,teams,git,notifications}-service` |
| PostgreSQL per service (8 БД) | ✅ 8 инстансов в `docker-compose.yml`; `users` шарится между auth и users (как на схеме) |
| Redis: кэш + Pub/Sub | ✅ контейнер `redis`; используется в auth (whitelist refresh-токенов), projects/git (кэш списков), tasks→notifications (Pub/Sub `mimi:events:tasks`) |
| Database per Service | ✅ |
| Docker-контейнеры + Docker Compose | ✅ корневой `docker-compose.yml` со всеми 11 контейнерами + frontend + gateway |

## Практика 8 — Техническое задание (ГОСТ 34.602-2020)

| Раздел ТЗ | Реализация |
| --- | --- |
| Структура из 9 подсистем | ✅ 9 микросервисов |
| REST API между сервисами | ✅ |
| Redis Pub/Sub для асинхронных событий | ✅ `internal/events.TaskChannel` + `notifications-service` consumer |
| SSE для real-time | ✅ `notifications-service GET /notifications/stream` |
| Минимальные требования к серверу | ✅ Ubuntu base, Docker, ~1.5 GB RAM (8 Postgres'ов — самые прожорливые) |

## Практика 9 — Организация разработки

| Артефакт | Реализация |
| --- | --- |
| Методология Kanban + Jira | ⛔ организационный |
| Git-репозиторий | ✅ `https://github.com/GillerYugent/Mimi`, ветка `claude/notion-style-project-TuatW` |
| Стек инструментов (Go 1.22, gorilla/mux, pgx/v5, go-redis, JWT, bcrypt, …) | ✅ все используются — см. `backend/go.mod` |

## Практика 10 — Документация ПО

| Артефакт | Реализация |
| --- | --- |
| API-документация (Swagger/swaggo) | 🟡 swag-аннотации не добавлены в код; OpenAPI можно сгенерировать из аннотаций. Сейчас документация — этот файл + `backend/README.md` |
| GitHub Wiki — пользовательская документация | ⛔ внешнее, не код |

## Практика 11 — Подготовка к тестированию

| Артефакт практики | Реализация |
| --- | --- |
| 10 тест-кейсов (TC-1…TC-10) | ✅ `tests/postman/mimi.postman_collection.json` |
| Чек-лист из 40 проверок | 🟡 функциональные проверки покрыты Postman'ом; UI-проверки (рендер в браузерах, адаптивность, кэш Redis CLI) — см. `tests/README.md`, выполняются вручную или через дополнительные инструменты |
| Инструменты: Postman/k6/OWASP ZAP/Playwright/BrowserStack | 🟡 Postman + k6 включены в репо. ZAP — команда в `tests/README.md`. Playwright и BrowserStack — не настроены (требуют браузерных бинарей в CI) |
| Дополненная матрица требований с «Результат тестирования» | 🟡 этот файл и `tests/README.md` выполняют ту же роль |

## Практика 12 — Программа и методика испытаний

| Раздел | Реализация |
| --- | --- |
| Объект испытаний | ✅ перечень микросервисов задокументирован в `backend/README.md` |
| Цели испытаний | ✅ unit + load + API + security |
| Методика по сценариям | ✅ Postman-сценарии (10 шт.) + k6 нагрузочный |
| Метрологическое обеспечение | ✅ k6 даёт p95/p99/error_rate автоматически |
| Перечень работ после испытаний | ⛔ организационный |

## Практика 13 — Анализ рисков (на этапе разработки)

10 рисков из отчёта (недооценка объёма, низкая вовлечённость, конфликты API, потеря кода, нестабильный сервер, изменение требований, слабая документация, конфликты веток, баги JWT/bcrypt) — это организационная аналитика. Технические риски (баг JWT/bcrypt) закрыты тестами, конфликт веток — branch protection (вне репо).

## Практика 14 — Анализ эксплуатационных рисков

| Угроза | Митигация |
| --- | --- |
| Отказ PostgreSQL | 🟡 в проде — нужна репликация (Patroni). Сейчас: бэкап через `pg_dump` (контейнер не настроен) |
| OOM/CPU перегрузка | ✅ `restart: unless-stopped` + healthcheck. Лимиты ресурсов можно задать в Compose через `deploy.resources` |
| Регрессия при деплое | 🟡 Go unit-тесты + Postman + k6 в CI устранят большую часть; smoke-тесты после деплоя — отдельная задача |

## Что можно ещё доделать

1. **Бэкап Postgres** — добавить контейнер с cron'ом и `pg_dump` всех 8 БД в volume, ротация 30 дней.
2. **Swagger/swaggo-аннотации** в каждом handler'е → автогенерация OpenAPI.
3. **Playwright E2E** — несколько критичных сценариев (register → создать проект → задачу → закрыть).
4. **Rate-limiting** на gateway (NGINX `limit_req`) — защита от brute-force на `/api/auth/login`.
5. **TLS** — certbot контейнер + `listen 443 ssl` в gateway.
6. **Prometheus + Grafana** — `/metrics` endpoint в каждом сервисе через `prometheus/client_golang`, dashboard для uptime/latency.
7. **Monorepo CI** (GitHub Actions): `go test`, `go vet`, `npm run build`, `newman run`, `k6 run --threshold-fail-on-validation`.

Большая часть из перечисленного — это infra/DevOps, не функционал продукта. Ядро (9 микросервисов + 13 таблиц БД + полнофункциональный фронтенд) реализовано в полном соответствии практикам.
