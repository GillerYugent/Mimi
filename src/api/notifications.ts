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

// Stream открывает SSE-соединение и возвращает функцию отписки.
// EventSource не умеет ставить headers — токен передаётся через query.
export function streamNotifications(
  onNotification: (n: Notification) => void,
  onError?: (e: Event) => void
): () => void {
  const t = getTokens()
  if (!t) return () => {}

  const url = `/api/notifications/stream?token=${encodeURIComponent(t.accessToken)}`
  const es = new EventSource(url)

  es.addEventListener('notification', (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as Notification
      onNotification(data)
    } catch {
      // ignore malformed payload
    }
  })

  if (onError) es.addEventListener('error', onError)

  return () => es.close()
}
