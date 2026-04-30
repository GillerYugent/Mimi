# Тесты Mimi

Соответствует практическим работам №11 («Подготовка к тестированию продукта») и №12 («Программа и методика испытаний»).

## Состав

| Тип | Где | Что проверяет |
| --- | --- | --- |
| **Unit (Go)** | `backend/internal/auth/*_test.go`, `backend/internal/gitprovider/*_test.go`, `backend/services/auth/*_test.go` | JWT issue/parse, ротация jti, истёкшие токены; bcrypt cost ≥ 12; парсер URL'ов GitHub/GitLab; сериализация preferences |
| **API (Postman / Newman)** | `tests/postman/mimi.postman_collection.json` | TC-1…TC-10 из практики 11 |
| **Load (k6)** | `tests/k6/load.js` | НФТ из практики 4: 500 VU → p95 ≤ 300 мс, error rate < 1% |

## Запуск

### Unit-тесты

```bash
cd backend
go test ./...                  # запустить все
go test -cover ./...           # с покрытием
go test -v ./internal/auth     # подробный вывод по пакету
```

### Postman / Newman

```bash
# Запустить весь стек
docker compose up -d --build

# Установить newman, если нет
npm install -g newman

# Прогнать TC-1…TC-10
newman run tests/postman/mimi.postman_collection.json \
    --env-var baseUrl=http://localhost:8080
```

### k6 нагрузочный

```bash
# Установить k6 (https://k6.io/docs/get-started/installation/)

# Запустить стек
docker compose up -d --build

# Прогнать тест
k6 run --env BASE_URL=http://localhost:8080 tests/k6/load.js
```

Метрики, которые проверяются автоматически:

- `http_req_duration{scenario:nominal}` — `p(95) < 300`
- `errors` — `rate < 0.01`
- `auth_latency` — `p(95) < 500`

### OWASP ZAP (security scan)

Не входит в репо (запускается в CI или вручную):

```bash
docker run --rm -v $(pwd):/zap/wrk/:rw -t ghcr.io/zaproxy/zaproxy:stable \
    zap-baseline.py -t http://host.docker.internal:8080 -r zap-report.html
```

## Чек-лист (практика 11, таблица 11.2)

| # | Что проверяется | Откуда |
| --- | --- | --- |
| 1 | Регистрация (позитив) | TC-1 в Postman |
| 2 | Дублирующий email (негатив) | TC-2 |
| 3 | Авторизация (позитив) | TC-3 |
| 4 | Неверный пароль | TC-4 |
| 5 | Создание проекта | TC-5 |
| 6 | Список проектов | TC-6 |
| 7 | Создание задачи без названия | TC-7 |
| 8 | Создание задачи (позитив) | TC-8 |
| 9 | Drag-and-drop задачи (PATCH /tasks/{id}) | TC-9 |
| 10 | Истёкший access-token → 401 | TC-10 |
| 11 | bcrypt cost ≥ 12 | `password_test.go::TestHashPassword_AcceptsCost12` |
| 12 | JWT signed/verified | `jwt_test.go::TestIssueAndParse_RoundTrip` |
| 13 | JWT expired rejected | `jwt_test.go::TestParse_RejectsExpired` |
| 14 | JWT wrong-secret rejected | `jwt_test.go::TestParse_RejectsWrongSecret` |
| 15 | Уникальные jti | `jwt_test.go::TestIssue_GeneratesUniqueJTI` |
| 16 | Парсер repo URL (GitHub/GitLab/SSH) | `gitprovider_test.go::TestParseRepoPath` |
| 17 | Время ответа API p95 ≤ 300 мс | k6 threshold |
| 18 | Error rate < 1% | k6 threshold |

Большая часть UI-чек-листа (drag-and-drop через Kanban, рендеринг канваса в Chrome/Firefox/Safari/Edge, адаптивность 360px) проверяется вручную или через Playwright/BrowserStack — это вне зоны ответственности этого репо в текущем MVP.
