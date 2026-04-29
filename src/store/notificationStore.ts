import { create } from 'zustand'
import type { Notification, NotificationType } from '@/types'
import { notificationsApi, streamNotifications } from '@/api/notifications'

interface NotificationState {
  items: Notification[]
  unread: number
  streamCloser: (() => void) | null

  load: () => Promise<void>
  startStream: () => void
  stopStream: () => void

  // Локальный publish — добавляет уведомление в стор немедленно
  // (используется внутри SSE и для оптимистичных уведомлений на клиенте).
  notify: (input: { userId: string; type: NotificationType; title: string; body?: string; link?: string }) => void

  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  remove: (id: string) => Promise<void>
  clearRead: () => Promise<void>

  byUser: (userId: string) => Notification[]
  unreadCount: (userId: string) => number

  reset: () => void
}

export const useNotifications = create<NotificationState>((set, get) => ({
  items: [],
  unread: 0,
  streamCloser: null,

  load: async () => {
    const list = await notificationsApi.list(100)
    set({
      items: list,
      unread: list.filter((n) => !n.isRead).length,
    })
  },

  startStream: () => {
    if (get().streamCloser) return
    const close = streamNotifications((n) => {
      // Защита от дублей: если уведомление уже есть, обновляем; иначе кладём в начало.
      const existing = get().items.findIndex((x) => x.id === n.id)
      if (existing >= 0) {
        const next = [...get().items]
        next[existing] = n
        set({ items: next })
      } else {
        set({
          items: [n, ...get().items].slice(0, 500),
          unread: get().unread + (n.isRead ? 0 : 1),
        })
      }
    })
    set({ streamCloser: close })
  },

  stopStream: () => {
    const close = get().streamCloser
    if (close) close()
    set({ streamCloser: null })
  },

  notify: (input) => {
    // Только локальный push: реальные backend-события приходят через SSE.
    // Здесь — для UX, если что-то нужно подсветить пользователю немедленно.
    const n: Notification = {
      id: 'local-' + Date.now(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body || '',
      link: input.link,
      isRead: false,
      createdAt: new Date().toISOString(),
    }
    set({ items: [n, ...get().items].slice(0, 500), unread: get().unread + 1 })
  },

  markRead: async (id) => {
    const item = get().items.find((n) => n.id === id)
    if (!item || item.isRead) return
    // Оптимистично
    set({
      items: get().items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unread: Math.max(0, get().unread - 1),
    })
    if (!id.startsWith('local-')) {
      try {
        await notificationsApi.markRead(id)
      } catch {
        // ignore
      }
    }
  },

  markAllRead: async () => {
    set({
      items: get().items.map((n) => ({ ...n, isRead: true })),
      unread: 0,
    })
    try {
      await notificationsApi.markAllRead()
    } catch {
      // ignore
    }
  },

  remove: async (id) => {
    const wasUnread = !!get().items.find((n) => n.id === id && !n.isRead)
    set({
      items: get().items.filter((n) => n.id !== id),
      unread: wasUnread ? Math.max(0, get().unread - 1) : get().unread,
    })
    if (!id.startsWith('local-')) {
      try {
        await notificationsApi.remove(id)
      } catch {
        // ignore
      }
    }
  },

  clearRead: async () => {
    set({ items: get().items.filter((n) => !n.isRead) })
    try {
      await notificationsApi.clearRead()
    } catch {
      // ignore
    }
  },

  byUser: () => get().items,
  unreadCount: () => get().unread,

  reset: () => {
    const close = get().streamCloser
    if (close) close()
    set({ items: [], unread: 0, streamCloser: null })
  },
}))
