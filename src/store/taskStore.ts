import { create } from 'zustand'
import type { ID, Task, TaskPriority, TaskStatus } from '@/types'
import { tasksApi } from '@/api/tasks'

interface TaskFilters {
  search?: string
  status?: TaskStatus
  assigneeId?: ID
  label?: string
  priority?: TaskPriority
}

interface TaskState {
  tasks: Record<string, Task>
  loadedProjects: Record<string, boolean>
  statsByProject: Record<string, { total: number; inProgress: number; done: number; overdue: number }>

  loadByProject: (projectId: string, opts?: { includeSubtasks?: boolean }) => Promise<Task[]>
  loadStats: (projectId: string) => Promise<void>
  loadSubtasks: (parentId: string) => Promise<Task[]>

  createTask: (
    input: Partial<Task> & { projectId: string; title: string }
  ) => Promise<{ ok: true; task: Task } | { ok: false; error: string }>
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  moveTask: (id: string, status: TaskStatus, order?: number) => Promise<void>
  setStatus: (id: string, status: TaskStatus) => Promise<void>

  // Selectors (sync)
  byProject: (projectId: string, filters?: TaskFilters) => Task[]
  subtasks: (parentId: string) => Task[]
  stats: (projectId: string) => { total: number; inProgress: number; done: number; overdue: number }
  getTask: (id: string) => Task | undefined

  reset: () => void
}

const EMPTY_STATS = { total: 0, inProgress: 0, done: 0, overdue: 0 }

export const useTasks = create<TaskState>((set, get) => ({
  tasks: {},
  loadedProjects: {},
  statsByProject: {},

  loadByProject: async (projectId, opts) => {
    const list = await tasksApi.list({
      projectId,
      includeSubtasks: opts?.includeSubtasks ?? true, // загружаем сразу всё, чтобы subtasks() работал из кэша
    })
    const next = { ...get().tasks }
    // Очистим старые задачи проекта, чтобы удалённые на сервере исчезли
    // и из локального кэша.
    for (const id of Object.keys(next)) {
      if (next[id].projectId === projectId) delete next[id]
    }
    for (const t of list) next[t.id] = t
    set({
      tasks: next,
      loadedProjects: { ...get().loadedProjects, [projectId]: true },
    })
    return list
  },

  loadStats: async (projectId) => {
    try {
      const s = await tasksApi.stats(projectId)
      set({ statsByProject: { ...get().statsByProject, [projectId]: s } })
    } catch {
      // ignore
    }
  },

  loadSubtasks: async (parentId) => {
    const list = await tasksApi.subtasks(parentId)
    const next = { ...get().tasks }
    for (const t of list) next[t.id] = t
    set({ tasks: next })
    return list
  },

  createTask: async (input) => {
    const title = (input.title || '').trim()
    if (!title) return { ok: false, error: 'Поле «название» обязательно' }
    try {
      const t = await tasksApi.create({
        projectId: input.projectId,
        parentTaskId: input.parentTaskId,
        title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        labels: input.labels,
        assigneeId: input.assigneeId,
        deadline: input.deadline,
        commitSha: input.commitSha,
        pullRequestUrl: input.pullRequestUrl,
        order: input.order,
      })
      set({ tasks: { ...get().tasks, [t.id]: t } })
      // Обновим stats фоном.
      void get().loadStats(input.projectId)
      return { ok: true, task: t }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Ошибка создания' }
    }
  },

  updateTask: async (id, updates) => {
    const prev = get().tasks[id]
    // Маппинг clear-флагов: если updates содержит null/undefined для assigneeId/deadline, серверу нужны явные clear-флаги.
    const payload: Parameters<typeof tasksApi.update>[1] = { ...updates }
    if ('assigneeId' in updates && (updates.assigneeId === undefined || updates.assigneeId === null)) {
      payload.clearAssignee = true
      delete payload.assigneeId
    }
    if ('deadline' in updates && (updates.deadline === undefined || updates.deadline === null)) {
      payload.clearDeadline = true
      delete payload.deadline
    }
    const t = await tasksApi.update(id, payload)
    set({ tasks: { ...get().tasks, [id]: t } })
    if (prev) void get().loadStats(prev.projectId)
  },

  deleteTask: async (id) => {
    const prev = get().tasks[id]
    await tasksApi.delete(id)
    const next = { ...get().tasks }
    // Удаляем задачу и все её подзадачи (каскадно на бэке + чистим локальный кэш)
    const toDelete = new Set<string>([id])
    let changed = true
    while (changed) {
      changed = false
      for (const t of Object.values(next)) {
        if (t.parentTaskId && toDelete.has(t.parentTaskId) && !toDelete.has(t.id)) {
          toDelete.add(t.id)
          changed = true
        }
      }
    }
    for (const x of toDelete) delete next[x]
    set({ tasks: next })
    if (prev) void get().loadStats(prev.projectId)
  },

  moveTask: async (id, status, order) => {
    await get().updateTask(id, { status, ...(order !== undefined ? { order } : {}) })
  },

  setStatus: async (id, status) => {
    await get().updateTask(id, { status })
  },

  byProject: (projectId, filters) => {
    const all = Object.values(get().tasks).filter((t) => t.projectId === projectId && !t.parentTaskId)
    if (!filters) return all.sort((a, b) => a.order - b.order)
    let list = all
    if (filters.search) {
      const q = filters.search.toLowerCase()
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    }
    if (filters.status) list = list.filter((t) => t.status === filters.status)
    if (filters.assigneeId) list = list.filter((t) => t.assigneeId === filters.assigneeId)
    if (filters.label) list = list.filter((t) => t.labels.includes(filters.label!))
    if (filters.priority) list = list.filter((t) => t.priority === filters.priority)
    return list.sort((a, b) => a.order - b.order)
  },

  subtasks: (parentId) =>
    Object.values(get().tasks)
      .filter((t) => t.parentTaskId === parentId)
      .sort((a, b) => a.order - b.order),

  stats: (projectId) => get().statsByProject[projectId] ?? EMPTY_STATS,
  getTask: (id) => get().tasks[id],

  reset: () => set({ tasks: {}, loadedProjects: {}, statsByProject: {} }),
}))
