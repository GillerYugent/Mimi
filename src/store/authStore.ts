import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Session, NotificationPrefs } from '@/types'
import { fakeHash, verifyFakeHash, fakeJwt, uid } from '@/utils/id'

const ACCESS_TOKEN_TTL = 15 * 60 * 1000 // 15 min (per ТЗ)
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

const DEFAULT_PREFS: NotificationPrefs = {
  taskAssigned: true,
  taskStatusChanged: true,
  teamInvited: true,
  mentionedInDoc: true,
}

interface AuthState {
  users: User[]
  session: Session | null
  register: (input: { name: string; email: string; password: string }) => { ok: true } | { ok: false; error: string }
  login: (input: { email: string; password: string }) => { ok: true } | { ok: false; error: string }
  logout: () => void
  refresh: () => void
  updateProfile: (updates: Partial<Pick<User, 'name' | 'avatarUrl' | 'email'>>) => void
  changePassword: (current: string, next: string) => { ok: true } | { ok: false; error: string }
  updateNotificationPrefs: (prefs: Partial<NotificationPrefs>) => void
  currentUser: () => User | undefined
  getUser: (id: string) => User | undefined
  // Used when inviting people not yet registered:
  upsertPlaceholderUser: (email: string, name?: string) => User
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      users: [],
      session: null,

      register: ({ name, email, password }) => {
        const email_n = email.trim().toLowerCase()
        if (!email_n || !password || !name) return { ok: false, error: 'Заполните все поля' }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email_n)) return { ok: false, error: 'Некорректный email' }
        if (password.length < 6) return { ok: false, error: 'Пароль должен быть не короче 6 символов' }
        if (get().users.some((u) => u.email === email_n)) return { ok: false, error: 'Email уже занят' }

        const user: User = {
          id: uid('u'),
          name: name.trim(),
          email: email_n,
          passwordHash: fakeHash(password),
          createdAt: new Date().toISOString(),
          notificationPrefs: { ...DEFAULT_PREFS },
        }
        const now = Date.now()
        const session: Session = {
          userId: user.id,
          accessToken: fakeJwt({ sub: user.id }, ACCESS_TOKEN_TTL),
          refreshToken: fakeJwt({ sub: user.id, type: 'refresh' }, REFRESH_TOKEN_TTL),
          issuedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + ACCESS_TOKEN_TTL).toISOString(),
        }
        set({ users: [...get().users, user], session })
        return { ok: true }
      },

      login: ({ email, password }) => {
        const email_n = email.trim().toLowerCase()
        const user = get().users.find((u) => u.email === email_n)
        if (!user || !verifyFakeHash(password, user.passwordHash)) {
          return { ok: false, error: 'Неверный email или пароль' }
        }
        const now = Date.now()
        const session: Session = {
          userId: user.id,
          accessToken: fakeJwt({ sub: user.id }, ACCESS_TOKEN_TTL),
          refreshToken: fakeJwt({ sub: user.id, type: 'refresh' }, REFRESH_TOKEN_TTL),
          issuedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + ACCESS_TOKEN_TTL).toISOString(),
        }
        set({ session })
        return { ok: true }
      },

      logout: () => set({ session: null }),

      refresh: () => {
        const s = get().session
        if (!s) return
        const now = Date.now()
        set({
          session: {
            ...s,
            accessToken: fakeJwt({ sub: s.userId }, ACCESS_TOKEN_TTL),
            issuedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + ACCESS_TOKEN_TTL).toISOString(),
          },
        })
      },

      updateProfile: (updates) => {
        const s = get().session
        if (!s) return
        set({
          users: get().users.map((u) => (u.id === s.userId ? { ...u, ...updates } : u)),
        })
      },

      changePassword: (current, next) => {
        const s = get().session
        if (!s) return { ok: false, error: 'Не авторизован' }
        const user = get().users.find((u) => u.id === s.userId)
        if (!user) return { ok: false, error: 'Пользователь не найден' }
        if (!verifyFakeHash(current, user.passwordHash)) return { ok: false, error: 'Текущий пароль неверен' }
        if (next.length < 6) return { ok: false, error: 'Пароль должен быть не короче 6 символов' }
        set({
          users: get().users.map((u) => (u.id === user.id ? { ...u, passwordHash: fakeHash(next) } : u)),
        })
        return { ok: true }
      },

      updateNotificationPrefs: (prefs) => {
        const s = get().session
        if (!s) return
        set({
          users: get().users.map((u) =>
            u.id === s.userId ? { ...u, notificationPrefs: { ...u.notificationPrefs, ...prefs } } : u
          ),
        })
      },

      currentUser: () => {
        const s = get().session
        if (!s) return undefined
        return get().users.find((u) => u.id === s.userId)
      },

      getUser: (id) => get().users.find((u) => u.id === id),

      upsertPlaceholderUser: (email, name) => {
        const email_n = email.trim().toLowerCase()
        const existing = get().users.find((u) => u.email === email_n)
        if (existing) return existing
        const user: User = {
          id: uid('u'),
          name: name?.trim() || email_n.split('@')[0],
          email: email_n,
          // placeholder: not logged-in-able until they actually register
          passwordHash: fakeHash(uid()),
          createdAt: new Date().toISOString(),
          notificationPrefs: { ...DEFAULT_PREFS },
        }
        set({ users: [...get().users, user] })
        return user
      },
    }),
    { name: 'mimi.auth' }
  )
)
