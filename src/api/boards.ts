import type { Canvas, CanvasElement } from '@/types'
import { get, post, patch, del } from './client'

interface ScopeQuery {
  projectId?: string
  mySpaceId?: string
}

interface CreateInput extends ScopeQuery {
  title?: string
  elements?: CanvasElement[]
}

interface UpdateInput {
  title?: string
  elements?: CanvasElement[]
}

function scopeQs(s: ScopeQuery): string {
  const p = new URLSearchParams()
  if (s.projectId) p.set('projectId', s.projectId)
  if (s.mySpaceId) p.set('mySpaceId', s.mySpaceId)
  const out = p.toString()
  return out ? `?${out}` : ''
}

export const boardsApi = {
  list: (scope: ScopeQuery) => get<Canvas[]>(`/boards${scopeQs(scope)}`),
  create: (input: CreateInput) => post<Canvas>('/boards', input),
  byId: (id: string) => get<Canvas>(`/boards/${id}`),
  update: (id: string, updates: UpdateInput) => patch<Canvas>(`/boards/${id}`, updates),
  delete: (id: string) => del<void>(`/boards/${id}`),
}
