import { create } from 'zustand'
import type { Commit, GitRepo, ID, Project, PullRequest } from '@/types'
import { projectsApi } from '@/api/projects'
import { gitApi, toGitRepo } from '@/api/git'

interface ProjectState {
  projects: Record<string, Project>
  activeOrder: string[]
  archivedOrder: string[]
  loaded: boolean

  // Loaders
  loadAll: () => Promise<void>
  loadOne: (id: string) => Promise<Project | undefined>

  // Mutations (async, server-side)
  createProject: (input: {
    title: string
    description?: string
    icon?: string
    teamId?: string
    ownerId?: ID // ignored — owner = current authenticated user
  }) => Promise<Project>
  updateProject: (id: string, updates: Partial<Pick<Project, 'title' | 'description' | 'icon' | 'teamId'>>) => Promise<void>
  archiveProject: (id: string) => Promise<void>
  restoreProject: (id: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  // Selectors (sync, in-memory)
  getProject: (id: string) => Project | undefined
  listActive: (userId?: string) => Project[]
  listArchived: (userId?: string) => Project[]

  // Git connection — управляется через git-service, локально кэшируем
  // в поле gitRepo проекта для быстрого UI.
  loadGitRepo: (projectId: string) => Promise<{ id: string; repo: GitRepo } | null>
  connectGit: (
    projectId: string,
    input: { provider: 'github' | 'gitlab'; url: string; accessToken?: string }
  ) => Promise<{ id: string; repo: GitRepo }>
  disconnectGit: (projectId: string, gitRepoId: string) => Promise<void>
  getMockCommits: (repoUrl: string) => Commit[]
  getMockPullRequests: (repoUrl: string) => PullRequest[]

  // Reset on logout
  reset: () => void
}

export const useProjects = create<ProjectState>((set, get) => ({
  projects: {},
  activeOrder: [],
  archivedOrder: [],
  loaded: false,

  loadAll: async () => {
    const [active, archived] = await Promise.all([
      projectsApi.list('active'),
      projectsApi.list('archived'),
    ])
    const map: Record<string, Project> = {}
    for (const p of active) map[p.id] = p
    for (const p of archived) map[p.id] = p
    set({
      projects: map,
      activeOrder: active.map((p) => p.id),
      archivedOrder: archived.map((p) => p.id),
      loaded: true,
    })
  },

  loadOne: async (id) => {
    try {
      const p = await projectsApi.byId(id)
      set({ projects: { ...get().projects, [p.id]: p } })
      return p
    } catch {
      return undefined
    }
  },

  createProject: async (input) => {
    const p = await projectsApi.create({
      title: input.title,
      description: input.description,
      icon: input.icon,
      teamId: input.teamId,
    })
    set({
      projects: { ...get().projects, [p.id]: p },
      activeOrder: [p.id, ...get().activeOrder],
    })
    return p
  },

  updateProject: async (id, updates) => {
    const p = await projectsApi.update(id, updates)
    set({ projects: { ...get().projects, [p.id]: p } })
  },

  archiveProject: async (id) => {
    const p = await projectsApi.archive(id)
    set({
      projects: { ...get().projects, [p.id]: p },
      activeOrder: get().activeOrder.filter((x) => x !== id),
      archivedOrder: [id, ...get().archivedOrder],
    })
  },

  restoreProject: async (id) => {
    const p = await projectsApi.restore(id)
    set({
      projects: { ...get().projects, [p.id]: p },
      archivedOrder: get().archivedOrder.filter((x) => x !== id),
      activeOrder: [id, ...get().activeOrder],
    })
  },

  deleteProject: async (id) => {
    await projectsApi.delete(id)
    const next = { ...get().projects }
    delete next[id]
    set({
      projects: next,
      activeOrder: get().activeOrder.filter((x) => x !== id),
      archivedOrder: get().archivedOrder.filter((x) => x !== id),
    })
  },

  getProject: (id) => get().projects[id],
  listActive: () => get().activeOrder.map((id) => get().projects[id]).filter(Boolean),
  listArchived: () => get().archivedOrder.map((id) => get().projects[id]).filter(Boolean),

  loadGitRepo: async (projectId) => {
    try {
      const r = await gitApi.byProject(projectId)
      if (!r) {
        // Очистим возможный устаревший gitRepo в проекте.
        const p = get().projects[projectId]
        if (p?.gitRepo) {
          const np = { ...p }
          delete np.gitRepo
          set({ projects: { ...get().projects, [projectId]: np } })
        }
        return null
      }
      const repo = toGitRepo(r)
      const p = get().projects[projectId]
      if (p) {
        set({ projects: { ...get().projects, [projectId]: { ...p, gitRepo: repo } } })
      }
      return { id: r.id, repo }
    } catch {
      return null
    }
  },

  connectGit: async (projectId, input) => {
    const r = await gitApi.connect({
      projectId,
      provider: input.provider,
      repoUrl: input.url,
      accessToken: input.accessToken,
    })
    const repo = toGitRepo(r)
    const p = get().projects[projectId]
    if (p) {
      set({ projects: { ...get().projects, [projectId]: { ...p, gitRepo: repo } } })
    }
    return { id: r.id, repo }
  },

  disconnectGit: async (_projectId, gitRepoId) => {
    await gitApi.disconnect(gitRepoId)
    const p = get().projects[_projectId]
    if (p) {
      const np = { ...p }
      delete np.gitRepo
      set({ projects: { ...get().projects, [_projectId]: np } })
    }
  },

  // Заглушки на коммиты/PR оставлены для совместимости со старыми
  // компонентами. Реальные данные приходят через gitApi.commits / pullRequests
  // в самом GitPane.
  getMockCommits: () => [],
  getMockPullRequests: () => [],

  reset: () => set({ projects: {}, activeOrder: [], archivedOrder: [], loaded: false }),
}))
