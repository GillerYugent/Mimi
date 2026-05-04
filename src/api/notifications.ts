import type { Notification } from '@/types'
import { get, post, del, getTokens } from './client'

export const notificationsApi = {
  list: (limit = 50) => get<Notification[]>(`/notifications?limit=${limit}`),
  unreadCount: () => get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => post<void>(`/notifications/${id}/read`),
  markAllRead: () => post<void>('/notifications/read-all'),
  remove: (id: string) => del<void>(`/notifications/${id}`),
  clearRead: () => del<void>('/notifications/read'),
}

// streamNotifications opens an SSE connection and returns a cleanup function.
// EventSource cannot set Authorization headers, so the token is passed as a
// query parameter.  On any error (dropped connection, expired token, etc.) the
// function makes a REST probe so the api client's automatic token-refresh runs,
// then reopens the EventSource with the fresh token.
export function streamNotifications(
  onNotification: (n: Notification) => void,
): () => void {
  let closed = false
  let es: EventSource | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  function connect() {
    if (closed) return
    const t = getTokens()
    if (!t) return

    es = new EventSource(
      `/api/notifications/stream?token=${encodeURIComponent(t.accessToken)}`
    )

    es.addEventListener('notification', (e) => {
      try {
        onNotification(JSON.parse((e as MessageEvent).data) as Notification)
      } catch {
        // ignore malformed payload
      }
    })

    es.onerror = () => {
      es?.close()
      es = null
      if (closed) return
      // Probe the REST API — this triggers automatic token refresh (via the
      // api client's 401 → refresh → retry logic) before we reopen the SSE
      // connection with a fresh token.
      get<{ count: number }>('/notifications/unread-count')
        .catch(() => {/* ignore — we just want the side-effect of token refresh */})
        .finally(() => {
          if (!closed) {
            retryTimer = setTimeout(connect, 3_000)
          }
        })
    }
  }

  connect()

  return () => {
    closed = true
    if (retryTimer !== null) clearTimeout(retryTimer)
    es?.close()
    es = null
  }
}
