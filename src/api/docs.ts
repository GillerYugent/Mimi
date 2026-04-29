import type { Block, DocPage, DocVersion } from '@/types'
import { get, post, patch, del } from './client'

interface ScopeQuery {
  projectId?: string
  mySpaceId?: string
}

interface CreateInput extends ScopeQuery {
  title?: string
  icon?: string
  parentPageId?: string
  blocks?: Block[]
}

interface UpdateInput {
  title?: string
  icon?: string
  blocks?: Block[]
}

function scopeQs(s: ScopeQuery, extra?: Record<string, string>): string {
  const p = new URLSearchParams()
  if (s.projectId) p.set('projectId', s.projectId)
  if (s.mySpaceId) p.set('mySpaceId', s.mySpaceId)
  if (extra) for (const [k, v] of Object.entries(extra)) p.set(k, v)
  const out = p.toString()
  return out ? `?${out}` : ''
}

export const docsApi = {
  list: (scope: ScopeQuery) => get<DocPage[]>(`/docs${scopeQs(scope)}`),
  create: (input: CreateInput) => post<DocPage>('/docs', input),
  byId: (id: string) => get<DocPage>(`/docs/${id}`),
  update: (id: string, updates: UpdateInput) => patch<DocPage>(`/docs/${id}`, updates),
  delete: (id: string) => del<void>(`/docs/${id}`),
  children: (parentId: string) => get<DocPage[]>(`/docs/${parentId}/children`),
  search: (scope: ScopeQuery, q: string) =>
    get<DocPage[]>(`/docs/search${scopeQs(scope, { q })}`),
  saveVersion: (pageId: string) => post<DocVersion>(`/docs/${pageId}/versions`),
  versions: (pageId: string) => get<DocVersion[]>(`/docs/${pageId}/versions`),
  restoreVersion: (versionId: string) => post<DocPage>(`/docs/versions/${versionId}/restore`),
}
