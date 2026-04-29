import { get, post } from './client'

export interface PublicUser {
  id: string
  name: string
  email: string
  avatarUrl?: string
  createdAt: string
}

export interface MySpace {
  id: string
  userId: string
  createdAt: string
}

export const usersApi = {
  byId: (id: string) => get<PublicUser>(`/users/${id}`),
  batch: (ids: string[]) => post<PublicUser[]>('/users/batch', { ids }),
  search: (q: string) => get<PublicUser[]>(`/users/search?q=${encodeURIComponent(q)}`),
  mySpace: () => get<MySpace>('/users/me/space'),
}
