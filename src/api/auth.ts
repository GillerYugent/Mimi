import type { NotificationPrefs, User } from '@/types'
import { api, post, patch, get, setTokens, type Tokens } from './client'

interface BackendUser {
  id: string
  name: string
  email: string
  avatarUrl?: string
  notificationPrefs: NotificationPrefs
  createdAt: string
  updatedAt: string
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user: BackendUser
}

function toFrontUser(u: BackendUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    passwordHash: '', // never returned by backend; here for type compat
    createdAt: u.createdAt,
    notificationPrefs: u.notificationPrefs,
  }
}

function persistTokens(r: TokenResponse): User {
  const t: Tokens = {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Date.now() + r.expires_in * 1000,
  }
  setTokens(t)
  return toFrontUser(r.user)
}

export const authApi = {
  async register(input: { name: string; email: string; password: string }): Promise<User> {
    const r = await api<TokenResponse>('/auth/register', {
      method: 'POST',
      body: input,
      skipAuth: true,
    })
    return persistTokens(r)
  },

  async login(input: { email: string; password: string }): Promise<User> {
    const r = await api<TokenResponse>('/auth/login', {
      method: 'POST',
      body: input,
      skipAuth: true,
    })
    return persistTokens(r)
  },

  async logout(refreshToken: string): Promise<void> {
    try {
      await post<void>('/auth/logout', { refresh_token: refreshToken })
    } catch {
      // idempotent — игнорируем сетевые ошибки
    }
    setTokens(null)
  },

  async me(): Promise<User> {
    const u = await get<BackendUser>('/auth/me')
    return toFrontUser(u)
  },

  async updateProfile(updates: Partial<Pick<User, 'name' | 'avatarUrl' | 'email'>>): Promise<User> {
    const u = await patch<BackendUser>('/auth/me', updates)
    return toFrontUser(u)
  },

  async changePassword(current: string, next: string): Promise<void> {
    await post<void>('/auth/me/password', { current, next })
  },

  async updateNotificationPrefs(prefs: Partial<NotificationPrefs>): Promise<void> {
    await patch<void>('/auth/me/notifications', prefs)
  },
}
