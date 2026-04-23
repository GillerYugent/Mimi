import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ID, Notification, NotificationType } from '@/types'
import { uid } from '@/utils/id'

interface NotificationState {
  items: Notification[]
  notify: (input: {
    userId: ID
    type: NotificationType
    title: string
    body?: string
    link?: string
  }) => void
  markRead: (id: ID) => void
  markAllRead: (userId: ID) => void
  remove: (id: ID) => void
  clearRead: (userId: ID) => void
  byUser: (userId: ID) => Notification[]
  unreadCount: (userId: ID) => number
}

export const useNotifications = create<NotificationState>()(
  persist(
    (set, get) => ({
      items: [],

      notify: ({ userId, type, title, body, link }) => {
        const n: Notification = {
          id: uid('n'),
          userId,
          type,
          title,
          body: body || '',
          link,
          isRead: false,
          createdAt: new Date().toISOString(),
        }
        set({ items: [n, ...get().items].slice(0, 500) })
      },

      markRead: (id) => {
        set({ items: get().items.map((n) => (n.id === id ? { ...n, isRead: true } : n)) })
      },

      markAllRead: (userId) => {
        set({
          items: get().items.map((n) => (n.userId === userId ? { ...n, isRead: true } : n)),
        })
      },

      remove: (id) => set({ items: get().items.filter((n) => n.id !== id) }),

      clearRead: (userId) =>
        set({ items: get().items.filter((n) => n.userId !== userId || !n.isRead) }),

      byUser: (userId) =>
        get()
          .items.filter((n) => n.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

      unreadCount: (userId) => get().items.filter((n) => n.userId === userId && !n.isRead).length,
    }),
    { name: 'mimi.notifications' }
  )
)
