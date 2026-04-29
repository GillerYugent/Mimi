import type { Commit, GitRepo, PullRequest } from '@/types'
import { get, post, del } from './client'

export interface BackendRepo {
  id: string
  projectId: string
  provider: 'github' | 'gitlab'
  repoUrl: string
  repoPath: string
  connectedBy: string
  connectedAt: string
}

interface ConnectInput {
  projectId: string
  provider: 'github' | 'gitlab'
  repoUrl: string
  accessToken?: string
}

export const gitApi = {
  byProject: (projectId: string) =>
    get<BackendRepo | null>(`/git/repositories?projectId=${projectId}`),
  connect: (input: ConnectInput) => post<BackendRepo>('/git/repositories', input),
  disconnect: (id: string) => del<void>(`/git/repositories/${id}`),
  commits: (id: string) => get<Commit[]>(`/git/repositories/${id}/commits`),
  pullRequests: (id: string) => get<PullRequest[]>(`/git/repositories/${id}/pull-requests`),
}

// Helper: преобразует BackendRepo в GitRepo (фронтенд-тип, см. src/types).
export function toGitRepo(r: BackendRepo): GitRepo {
  return {
    url: r.repoUrl,
    provider: r.provider,
    connectedAt: r.connectedAt,
  }
}
