// HTTP-клиент к backend gateway. Управляет access/refresh токенами,
// автоматически рефрешит истёкший access на 401 и редиректит на /login,
// если refresh тоже невалиден.

const STORAGE_KEY = 'mimi.tokens'

export interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // ms timestamp
}

let cached: Tokens | null = loadTokens()

function loadTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Tokens
  } catch {
    return null
  }
}

export function getTokens(): Tokens | null {
  return cached
}

export function setTokens(t: Tokens | null) {
  cached = t
  if (t) localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
  else localStorage.removeItem(STORAGE_KEY)
}

export function isAuthenticated(): boolean {
  return cached !== null && cached.refreshToken.length > 0
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  // skipAuth — не добавлять Authorization (для публичных эндпоинтов).
  skipAuth?: boolean
  // _retry — внутренний флаг, чтобы избежать бесконечного refresh-loop.
  _retry?: boolean
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let refreshing: Promise<Tokens | null> | null = null

async function refreshTokens(): Promise<Tokens | null> {
  if (!cached?.refreshToken) return null
  if (refreshing) return refreshing

  refreshing = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: cached!.refreshToken }),
      })
      if (!res.ok) {
        setTokens(null)
        return null
      }
      const data = (await res.json()) as {
        access_token: string
        refresh_token: string
        expires_in: number
      }
      const t: Tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      }
      setTokens(t)
      return t
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  }

  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  if (!opts.skipAuth && cached?.accessToken) {
    headers['Authorization'] = `Bearer ${cached.accessToken}`
  }

  const res = await fetch(`/api${path}`, {
    ...opts,
    headers,
    body:
      opts.body === undefined
        ? undefined
        : opts.body instanceof FormData
          ? opts.body
          : JSON.stringify(opts.body),
  })

  // 401 + есть refresh + не повтор → попробовать обновить токен и повторить.
  if (res.status === 401 && !opts._retry && !opts.skipAuth && cached?.refreshToken) {
    const fresh = await refreshTokens()
    if (fresh) {
      return api(path, { ...opts, _retry: true })
    }
    // Refresh упал — выкидываем на логин (если мы не на нём уже).
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { error: text }
    }
  }

  if (!res.ok) {
    const e = (payload as { code?: string; error?: string }) || {}
    throw new ApiError(res.status, e.code || 'http_error', e.error || `HTTP ${res.status}`)
  }
  return payload as T
}

// Convenience helpers
export const get = <T>(path: string) => api<T>(path)
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body })
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body })
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' })
