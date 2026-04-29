import type { Task, TaskPriority, TaskStatus } from '@/types'
import { get, post, patch, del } from './client'

interface ListFilters {
  projectId?: string
  status?: TaskStatus
  assigneeId?: string
  priority?: TaskPriority
  label?: string
  search?: string
  includeSubtasks?: boolean
}

interface CreateInput {
  projectId: string
  parentTaskId?: string
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  labels?: string[]
  assigneeId?: string
  deadline?: string
  commitSha?: string
  pullRequestUrl?: string
  order?: number
}

interface UpdateInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  labels?: string[]
  assigneeId?: string
  deadline?: string
  commitSha?: string
  pullRequestUrl?: string
  order?: number
  clearAssignee?: boolean
  clearDeadline?: boolean
}

export interface BackendStats {
  total: number
  inProgress: number
  done: number
  overdue: number
}

function qs(filters: ListFilters): string {
  const p = new URLSearchParams()
  if (filters.projectId) p.set('projectId', filters.projectId)
  if (filters.status) p.set('status', filters.status)
  if (filters.assigneeId) p.set('assigneeId', filters.assigneeId)
  if (filters.priority) p.set('priority', filters.priority)
  if (filters.label) p.set('label', filters.label)
  if (filters.search) p.set('search', filters.search)
  if (filters.includeSubtasks) p.set('includeSubtasks', 'true')
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const tasksApi = {
  list: (filters: ListFilters = {}) => get<Task[]>(`/tasks${qs(filters)}`),
  create: (input: CreateInput) => post<Task>('/tasks', input),
  byId: (id: string) => get<Task>(`/tasks/${id}`),
  update: (id: string, updates: UpdateInput) => patch<Task>(`/tasks/${id}`, updates),
  delete: (id: string) => del<void>(`/tasks/${id}`),
  subtasks: (parentId: string) => get<Task[]>(`/tasks/${parentId}/subtasks`),
  stats: (projectId: string) => get<BackendStats>(`/tasks/stats?projectId=${projectId}`),
}
