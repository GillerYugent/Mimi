import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ID, Project, GitRepo, Commit, PullRequest } from '@/types'
import { uid } from '@/utils/id'

interface ProjectState {
  projects: Project[]
  createProject: (input: { ownerId: ID; title: string; description?: string; icon?: string; teamId?: ID }) => Project
  updateProject: (id: ID, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => void
  archiveProject: (id: ID) => void
  restoreProject: (id: ID) => void
  deleteProject: (id: ID) => void
  getProject: (id: ID) => Project | undefined
  listActive: (userId: ID) => Project[]
  listArchived: (userId: ID) => Project[]
  connectGit: (projectId: ID, repo: Omit<GitRepo, 'connectedAt'>) => void
  disconnectGit: (projectId: ID) => void
  // Mocked git data (not persisted per-project — stored per repo URL deterministically)
  getMockCommits: (repoUrl: string) => Commit[]
  getMockPullRequests: (repoUrl: string) => PullRequest[]
}

const SAMPLE_COMMITS: Commit[] = [
  { sha: 'a3f5c21', message: 'feat(auth): add JWT refresh endpoint', author: 'Maxim Shestakov', date: new Date(Date.now() - 3 * 3600_000).toISOString() },
  { sha: 'b8d2e10', message: 'fix(tasks): preserve order on drag-and-drop', author: 'Maxim Shestakov', date: new Date(Date.now() - 26 * 3600_000).toISOString() },
  { sha: 'c4a9f08', message: 'docs: update README with setup steps', author: 'Danil Popov', date: new Date(Date.now() - 2 * 86400_000).toISOString() },
  { sha: 'd1e7b33', message: 'refactor(docs): extract BlockEditor', author: 'Maxim Shestakov', date: new Date(Date.now() - 3 * 86400_000).toISOString() },
  { sha: 'e6b4c72', message: 'chore: bump deps', author: 'Anton Smirnov', date: new Date(Date.now() - 5 * 86400_000).toISOString() },
]

const SAMPLE_PRS: PullRequest[] = [
  { number: 42, title: 'Kanban drag-and-drop with WIP limits', author: 'Maxim Shestakov', status: 'open', createdAt: new Date(Date.now() - 2 * 86400_000).toISOString() },
  { number: 41, title: 'Docs: nested page breadcrumbs', author: 'Danil Popov', status: 'open', createdAt: new Date(Date.now() - 5 * 86400_000).toISOString() },
]

export const useProjects = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],

      createProject: ({ ownerId, title, description, icon, teamId }) => {
        const now = new Date().toISOString()
        const project: Project = {
          id: uid('p'),
          title: title.trim() || 'Без названия',
          description: description?.trim() || '',
          ownerId,
          teamId,
          status: 'active',
          icon: icon || '📁',
          createdAt: now,
          updatedAt: now,
        }
        set({ projects: [project, ...get().projects] })
        return project
      },

      updateProject: (id, updates) => {
        set({
          projects: get().projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        })
      },

      archiveProject: (id) => get().updateProject(id, { status: 'archived' }),
      restoreProject: (id) => get().updateProject(id, { status: 'active' }),

      deleteProject: (id) => {
        set({ projects: get().projects.filter((p) => p.id !== id) })
      },

      getProject: (id) => get().projects.find((p) => p.id === id),

      listActive: (userId) =>
        get()
          .projects.filter(
            (p) => p.ownerId === userId && p.status === 'active' && !p.id.startsWith('my-space-')
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),

      listArchived: (userId) =>
        get()
          .projects.filter(
            (p) => p.ownerId === userId && p.status === 'archived' && !p.id.startsWith('my-space-')
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),

      connectGit: (projectId, repo) => {
        get().updateProject(projectId, {
          gitRepo: { ...repo, connectedAt: new Date().toISOString() },
        })
      },

      disconnectGit: (projectId) => {
        const project = get().getProject(projectId)
        if (!project) return
        const { gitRepo: _discarded, ...rest } = project
        void _discarded
        set({
          projects: get().projects.map((p) => (p.id === projectId ? { ...rest, updatedAt: new Date().toISOString() } : p)),
        })
      },

      getMockCommits: () => SAMPLE_COMMITS,
      getMockPullRequests: () => SAMPLE_PRS,
    }),
    { name: 'mimi.projects' }
  )
)
