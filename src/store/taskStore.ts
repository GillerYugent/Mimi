import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ID, Task, TaskStatus, TaskPriority } from '@/types'
import { uid } from '@/utils/id'

interface TaskFilters {
  search: string
  status?: TaskStatus
  assigneeId?: ID
  label?: string
  priority?: TaskPriority
}

interface TaskState {
  tasks: Task[]
  createTask: (input: Partial<Task> & { projectId: ID; title: string }) => { ok: true; task: Task } | { ok: false; error: string }
  updateTask: (id: ID, updates: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>) => void
  deleteTask: (id: ID) => void
  moveTask: (id: ID, status: TaskStatus, order?: number) => void
  setStatus: (id: ID, status: TaskStatus) => void
  byProject: (projectId: ID, filters?: Partial<TaskFilters>) => Task[]
  subtasks: (parentId: ID) => Task[]
  stats: (projectId: ID) => { total: number; inProgress: number; done: number; overdue: number }
  getTask: (id: ID) => Task | undefined
}

export const useTasks = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],

      createTask: (input) => {
        const title = (input.title || '').trim()
        if (!title) return { ok: false, error: 'Поле «название» обязательно' }
        const now = new Date().toISOString()
        const task: Task = {
          id: uid('t'),
          projectId: input.projectId,
          parentTaskId: input.parentTaskId,
          title,
          description: input.description || '',
          status: input.status || 'backlog',
          priority: input.priority || 'medium',
          labels: input.labels || [],
          assigneeId: input.assigneeId,
          deadline: input.deadline,
          commitSha: input.commitSha,
          pullRequestUrl: input.pullRequestUrl,
          createdAt: now,
          updatedAt: now,
          order: input.order ?? Date.now(),
        }
        set({ tasks: [...get().tasks, task] })
        return { ok: true, task }
      },

      updateTask: (id, updates) => {
        set({
          tasks: get().tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        })
      },

      deleteTask: (id) => {
        // Also delete subtasks recursively
        const toDelete = new Set<ID>([id])
        let changed = true
        while (changed) {
          changed = false
          for (const t of get().tasks) {
            if (t.parentTaskId && toDelete.has(t.parentTaskId) && !toDelete.has(t.id)) {
              toDelete.add(t.id)
              changed = true
            }
          }
        }
        set({ tasks: get().tasks.filter((t) => !toDelete.has(t.id)) })
      },

      moveTask: (id, status, order) => {
        get().updateTask(id, { status, ...(order !== undefined ? { order } : {}) })
      },

      setStatus: (id, status) => get().updateTask(id, { status }),

      byProject: (projectId, filters) => {
        let list = get().tasks.filter((t) => t.projectId === projectId && !t.parentTaskId)
        if (filters) {
          if (filters.search) {
            const q = filters.search.toLowerCase()
            list = list.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
          }
          if (filters.status) list = list.filter((t) => t.status === filters.status)
          if (filters.assigneeId) list = list.filter((t) => t.assigneeId === filters.assigneeId)
          if (filters.label) list = list.filter((t) => t.labels.includes(filters.label!))
          if (filters.priority) list = list.filter((t) => t.priority === filters.priority)
        }
        return list.sort((a, b) => a.order - b.order)
      },

      subtasks: (parentId) => get().tasks.filter((t) => t.parentTaskId === parentId).sort((a, b) => a.order - b.order),

      stats: (projectId) => {
        const list = get().tasks.filter((t) => t.projectId === projectId && !t.parentTaskId)
        const now = Date.now()
        return {
          total: list.length,
          inProgress: list.filter((t) => t.status === 'in_progress' || t.status === 'review' || t.status === 'todo').length,
          done: list.filter((t) => t.status === 'done').length,
          overdue: list.filter((t) => t.deadline && t.status !== 'done' && new Date(t.deadline).getTime() < now).length,
        }
      },

      getTask: (id) => get().tasks.find((t) => t.id === id),
    }),
    { name: 'mimi.tasks' }
  )
)
