import { create } from 'zustand'
import type { NotificationPrefs, User } from '@/types'
import { authApi } from '@/api/auth'
import { usersApi, type PublicUser } from '@/api/users'
import { ApiError, getTokens, setTokens } from '@/api/client'

interface AuthState {
  // Текущий пользователь — единственный «полный» User.
  user: User | null
  // Кэш публичных профилей других пользователей (для assignee, members и т.д.).
  publicUsers: Record<string, PublicUser>
  // Identity My Space (PK таблицы my_spaces в users-service).
  mySpaceId: string | null
  // ID проекта-обёртки для задач My Space (создаётся лениво через ensureMySpaceProject).
  mySpaceProjectId: string | null

  bootstrapping: boolean

  // Bootstrap — вызывается при старте приложения, если есть refresh-токен.
  bootstrap: () => Promise<void>

  register: (input: { name: string; email: string; password: string }) =>
    Promise<{ ok: true } | { ok: false; error: string }>
  login: (input: { email: string; password: string }) =>
    Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => Promise<void>

  updateProfile: (updates: Partial<Pick<User, 'name' | 'avatarUrl' | 'email'>>) => Promise<void>
  changePassword: (current: string, next: string) =>
    Promise<{ ok: true } | { ok: false; error: string }>
  updateNotificationPrefs: (prefs: Partial<NotificationPrefs>) => Promise<void>

  // Получить публичный профиль (с кэшем).
  fetchUser: (id: string) => Promise<PublicUser | undefined>
  fetchUsers: (ids: string[]) => Promise<void>
  searchUsers: (q: string) => Promise<PublicUser[]>

  // Обратная совместимость: возвращают данные синхронно из кэша.
  currentUser: () => User | undefined
  getUser: (id: string) => User | undefined
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  publicUsers: {},
  mySpaceId: null,
  mySpaceProjectId: null,
  bootstrapping: !!getTokens(),

  bootstrap: async () => {
    if (!getTokens()) {
      set({ bootstrapping: false })
      return
    }
    try {
      const [me, ms] = await Promise.all([authApi.me(), usersApi.mySpace()])
      set({ user: me, mySpaceId: ms.id })
    } catch {
      setTokens(null)
      set({ user: null, mySpaceId: null })
    } finally {
      set({ bootstrapping: false })
    }
  },

  register: async (input) => {
    try {
      const u = await authApi.register(input)
      const ms = await usersApi.mySpace()
      set({ user: u, mySpaceId: ms.id })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: errorMessage(e) }
    }
  },

  login: async (input) => {
    try {
      const u = await authApi.login(input)
      const ms = await usersApi.mySpace()
      set({ user: u, mySpaceId: ms.id })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: errorMessage(e) }
    }
  },

  logout: async () => {
    const t = getTokens()
    if (t) await authApi.logout(t.refreshToken)
    set({ user: null, mySpaceId: null, mySpaceProjectId: null, publicUsers: {} })
  },

  updateProfile: async (updates) => {
    const u = await authApi.updateProfile(updates)
    set({ user: u })
  },

  changePassword: async (current, next) => {
    try {
      await authApi.changePassword(current, next)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: errorMessage(e) }
    }
  },

  updateNotificationPrefs: async (prefs) => {
    await authApi.updateNotificationPrefs(prefs)
    const u = get().user
    if (!u) return
    set({ user: { ...u, notificationPrefs: { ...u.notificationPrefs, ...prefs } } })
  },

  fetchUser: async (id) => {
    if (!id) return undefined
    const cached = get().publicUsers[id]
    if (cached) return cached
    try {
      const u = await usersApi.byId(id)
      set({ publicUsers: { ...get().publicUsers, [id]: u } })
      return u
    } catch {
      return undefined
    }
  },

  fetchUsers: async (ids) => {
    const missing = ids.filter((id) => id && !get().publicUsers[id])
    if (missing.length === 0) return
    try {
      const users = await usersApi.batch(missing)
      const next = { ...get().publicUsers }
      for (const u of users) next[u.id] = u
      set({ publicUsers: next })
    } catch {
      // ignore
    }
  },

  searchUsers: (q) => usersApi.search(q),

  currentUser: () => get().user ?? undefined,
  getUser: (id) => {
    const me = get().user
    if (me && me.id === id) return me
    const p = get().publicUsers[id]
    if (!p) return undefined
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      avatarUrl: p.avatarUrl,
      passwordHash: '',
      createdAt: p.createdAt,
      notificationPrefs: {
        taskAssigned: true,
        taskStatusChanged: true,
        teamInvited: true,
        mentionedInDoc: true,
      },
    }
  },
}))

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message || 'Ошибка'
  if (e instanceof Error) return e.message
  return 'Ошибка'
}
