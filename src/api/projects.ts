import type { Project, ProjectStatus } from '@/types'
import { get, post, patch, del } from './client'

interface CreateInput {
  title: string
  description?: string
  icon?: string
  teamId?: string
}

interface UpdateInput {
  title?: string
  description?: string
  icon?: string
  teamId?: string
}

export const projectsApi = {
  list: (status: ProjectStatus = 'active') => get<Project[]>(`/projects?status=${status}`),
  create: (input: CreateInput) => post<Project>('/projects', input),
  byId: (id: string) => get<Project>(`/projects/${id}`),
  update: (id: string, updates: UpdateInput) => patch<Project>(`/projects/${id}`, updates),
  archive: (id: string) => post<Project>(`/projects/${id}/archive`),
  restore: (id: string) => post<Project>(`/projects/${id}/restore`),
  delete: (id: string) => del<void>(`/projects/${id}`),
}
