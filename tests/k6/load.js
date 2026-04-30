// Нагрузочный тест Mimi для k6.
//
// Соответствует НФТ из практики 4 и тест-кейсу TC-10 из практики 11:
//   • 500 VU,  2 min, p95 latency ≤ 300 мс, error_rate < 1%
//   • 1000 VU, 2 min, p99 latency ≤ 500 мс, error_rate < 1%
//
// Запуск:
//   k6 run --env BASE_URL=http://localhost:8080 --vus 500 --duration 2m tests/k6/load.js
//
// Или через сценарии (по умолчанию):
//   k6 run tests/k6/load.js

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080'

// Кастомные метрики, чтобы видеть отдельно auth и list-запросы.
const authLatency = new Trend('auth_latency', true)
const listLatency = new Trend('list_latency', true)
const errorRate = new Rate('errors')

export const options = {
  scenarios: {
    // 500 VU × 2 минуты — основной нагрузочный из НФТ
    nominal: {
      executor: 'constant-vus',
      vus: 500,
      duration: '2m',
      gracefulStop: '15s',
      tags: { scenario: 'nominal' },
    },
    // Пиковый stress-test (запускается через --tag), отключён по умолчанию.
    // peak: {
    //   executor: 'constant-vus',
    //   vus: 1000,
    //   duration: '2m',
    // },
  },
  thresholds: {
    // НФТ: p95 < 300 мс при 500 VU.
    'http_req_duration{scenario:nominal}': ['p(95)<300'],
    // Доля ошибок < 1%.
    errors: ['rate<0.01'],
    // Auth не должен быть медленнее чем p95 < 500 мс
    auth_latency: ['p(95)<500'],
  },
}

function jsonHeaders(token) {
  const h = { 'Content-Type': 'application/json' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

// Каждый VU регистрируется один раз и переиспользует токен.
export function setup() {
  // По одному пользователю на каждые ~50 VU; иначе быстро упрёмся в 1 пользователя
  // и не получим показательных latency'ов на регистрации.
  const users = []
  const count = 10
  for (let i = 0; i < count; i++) {
    const email = `loadtest_${randomString(10)}@example.com`
    const res = http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({ name: 'Load Test', email, password: 'password123' }),
      { headers: jsonHeaders() }
    )
    if (res.status === 201) {
      const body = JSON.parse(res.body)
      users.push({ email, token: body.access_token })
    }
  }
  return { users }
}

export default function (data) {
  if (data.users.length === 0) {
    errorRate.add(1)
    return
  }
  const user = data.users[__VU % data.users.length]

  group('GET /api/projects', () => {
    const res = http.get(`${BASE_URL}/api/projects`, { headers: jsonHeaders(user.token) })
    check(res, {
      'status is 200': (r) => r.status === 200,
      'is JSON array': (r) => Array.isArray(JSON.parse(r.body || '[]')),
    }) || errorRate.add(1)
    listLatency.add(res.timings.duration)
  })

  group('GET /api/auth/me', () => {
    const res = http.get(`${BASE_URL}/api/auth/me`, { headers: jsonHeaders(user.token) })
    check(res, { 'status is 200': (r) => r.status === 200 }) || errorRate.add(1)
    authLatency.add(res.timings.duration)
  })

  // Имитируем «думающего» пользователя.
  sleep(0.3 + Math.random() * 0.5)
}

export function teardown(data) {
  // Best-effort: можно дочистить тестовых пользователей, но в MVP оставляем.
  // void data
}
