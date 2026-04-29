import { useEffect, useState } from 'react'
import type { Commit, ID, PullRequest } from '@/types'
import { useProjects } from '@/store/projectStore'
import { gitApi } from '@/api/git'
import { formatRelative } from '@/utils/date'
import { IconGit, IconLink } from '@/components/ui/Icon'
import { Confirm } from '@/components/ui/Modal'

interface Props {
  projectId: ID
}

export function GitPane({ projectId }: Props) {
  const project = useProjects((s) => s.getProject(projectId))
  const loadGitRepo = useProjects((s) => s.loadGitRepo)
  const connectGit = useProjects((s) => s.connectGit)
  const disconnectGit = useProjects((s) => s.disconnectGit)

  const [repoMeta, setRepoMeta] = useState<{ id: string } | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [prs, setPrs] = useState<PullRequest[]>([])

  const [url, setUrl] = useState('https://github.com/GillerYugent/Mimi')
  const [provider, setProvider] = useState<'github' | 'gitlab'>('github')
  const [accessToken, setAccessToken] = useState('')
  const [confirmDisc, setConfirmDisc] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingFeed, setLoadingFeed] = useState(false)

  // 1) Грузим привязку репозитория из git-service.
  useEffect(() => {
    void (async () => {
      const r = await loadGitRepo(projectId)
      setRepoMeta(r ? { id: r.id } : null)
    })()
  }, [projectId])

  // 2) Если репо подключён — грузим коммиты и PR.
  useEffect(() => {
    if (!repoMeta?.id) return
    setLoadingFeed(true)
    void (async () => {
      try {
        const [c, p] = await Promise.all([
          gitApi.commits(repoMeta.id),
          gitApi.pullRequests(repoMeta.id),
        ])
        setCommits(c)
        setPrs(p)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить данные')
      } finally {
        setLoadingFeed(false)
      }
    })()
  }, [repoMeta?.id])

  if (!project) return null

  const onConnect = async () => {
    if (!url.trim()) return
    setConnecting(true)
    setError(null)
    try {
      const r = await connectGit(projectId, {
        url: url.trim(),
        provider,
        accessToken: accessToken.trim() || undefined,
      })
      setRepoMeta({ id: r.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось подключить репозиторий')
    } finally {
      setConnecting(false)
    }
  }

  const onDisconnect = async () => {
    if (!repoMeta) return
    await disconnectGit(projectId, repoMeta.id)
    setRepoMeta(null)
    setCommits([])
    setPrs([])
  }

  if (!project.gitRepo || !repoMeta) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-10">
        <div className="rounded-md border border-dashed border-line bg-paper-soft p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-paper-hover text-ink-light">
            <IconGit size={20} />
          </div>
          <h3 className="text-base font-semibold text-ink">Подключить репозиторий</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-light">
            Подключите GitHub или GitLab — git-service будет тянуть коммиты и Pull Requests
            рядом с задачами.
          </p>
          <div className="mx-auto mt-4 max-w-md space-y-2 text-left">
            <div className="flex gap-2">
              <select
                className="input w-auto"
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'github' | 'gitlab')}
              >
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
              </select>
              <input
                className="input flex-1"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
              />
            </div>
            <input
              className="input"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Personal Access Token (опционально, нужен для приватных репо)"
            />
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}
            <button
              className="btn btn-primary w-full text-sm"
              onClick={onConnect}
              disabled={connecting}
            >
              <IconLink size={14} /> {connecting ? 'Подключение…' : 'Подключить'}
            </button>
            <p className="text-center text-[11px] text-ink-lighter">
              git-service проверит доступ запросом 1 коммита перед сохранением.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-lighter">
            <IconGit size={12} /> {project.gitRepo.provider}
          </div>
          <a
            href={project.gitRepo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="title-serif break-all text-2xl font-bold text-ink hover:underline"
          >
            {project.gitRepo.url}
          </a>
          <p className="mt-1 text-sm text-ink-light">
            Подключён {formatRelative(project.gitRepo.connectedAt)}
          </p>
        </div>
        <button className="btn btn-danger text-sm" onClick={() => setConfirmDisc(true)}>
          Отключить
        </button>
      </div>

      <section className="mb-8">
        <h3 className="mb-2 text-sm font-semibold text-ink">
          Открытые Pull Requests · {prs.length}
        </h3>
        <div className="divide-y divide-line rounded-md border border-line bg-paper">
          {loadingFeed && <div className="px-4 py-3 text-sm text-ink-light">Загрузка…</div>}
          {!loadingFeed && prs.length === 0 && (
            <div className="px-4 py-3 text-sm text-ink-light">Нет открытых PR</div>
          )}
          {prs.map((pr) => (
            <a
              key={pr.number}
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-paper-hover"
            >
              <span className="chip">#{pr.number}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{pr.title}</div>
                <div className="text-xs text-ink-light">
                  {pr.author} · {formatRelative(pr.createdAt)}
                </div>
              </div>
              <span className="chip">{pr.status}</span>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">
          Последние коммиты · {commits.length}
        </h3>
        <div className="divide-y divide-line rounded-md border border-line bg-paper">
          {loadingFeed && commits.length === 0 && (
            <div className="px-4 py-3 text-sm text-ink-light">Загрузка…</div>
          )}
          {commits.map((c) => (
            <a
              key={c.sha}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-paper-hover"
            >
              <code className="rounded bg-paper-soft px-1.5 py-0.5 font-mono text-xs text-ink-light">
                {c.sha.slice(0, 7)}
              </code>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-ink">{c.message}</div>
                <div className="text-xs text-ink-light">
                  {c.author} · {formatRelative(c.date)}
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <Confirm
        open={confirmDisc}
        onClose={() => setConfirmDisc(false)}
        onConfirm={onDisconnect}
        title="Отключить репозиторий?"
        message="Связь с внешним репозиторием будет удалена, но задачи и документы сохранятся."
        destructive
        confirmText="Отключить"
      />
    </div>
  )
}

