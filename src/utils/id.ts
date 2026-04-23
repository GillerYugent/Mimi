// Simple ID generator (UUID-like for demo purposes)
export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36)
  return prefix ? `${prefix}_${time}${rand}` : `${time}${rand}`
}

// "hash" passwords with base64 — marked clearly as demo only
export function fakeHash(password: string): string {
  // In the real system (see ТЗ) — bcrypt cost ≥ 12.
  // For the browser demo we use a stable, non-reversible-looking transform.
  const salted = `$2b$12$demo.${btoa(unescape(encodeURIComponent(password)))}`
  return salted
}

export function verifyFakeHash(password: string, hash: string): boolean {
  return fakeHash(password) === hash
}

export function fakeJwt(payload: Record<string, unknown>, ttlMs: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(
    JSON.stringify({
      ...payload,
      iat: Date.now(),
      exp: Date.now() + ttlMs,
    })
  )
  const sig = btoa('demo-signature')
  return `${header}.${body}.${sig}`
}
