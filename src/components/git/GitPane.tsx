import { useState } from 'react'
import type { ID } from '@/types'
import { useProjects } from '@/store/projectStore'
import { formatRelative } from '@/utils/date'
import { IconGit, IconLink } from '@/components/ui/Icon'
import { Confirm } from '@/components/ui/Modal'

interface Props {
  projectId: ID
}

export function GitPane({ projectId }: Props) {
  const project = useProjects((s) => s.getProject(projectId))
  const connectGit = useProjects((s) => s.connectGit)
  const disconnectGit = useProjects((s) => s.disconnectGit)
  const commits = useProjects((s) => (project?.gitRepo ? s.getMockCommits(project.gitRepo.url) : []))
  const prs = useProjects((s) => (project?.gitRepo ? s.getMockPullRequests(project.gitRepo.url) : []))

  const [url, setUrl] = useState('https://github.com/GillerYugent/Mimi')
  const [provider, setProvider] = useState<'github' | 'gitlab'>('github')
  const [confirmDisc, setConfirmDisc] = useState(false)

  if (!project) return null

  const onConnect = () => {
    if (!url.trim()) return
    connectGit(projectId, { url: url.trim(), provider })
  }

  if (!project.gitRepo) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-10">
        <div className="rounded-md border border-dashed border-line bg-paper-soft p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-paper-hover text-ink-light">
            <IconGit size={20} />
          </div>
          <h3 className="text-base font-semibold text-ink">Подключить репозиторий</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-light">
            Подключите GitHub или GitLab, чтобы видеть коммиты и pull requests рядом с задачами.
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
            <button className="btn btn-primary w-full text-sm" onClick={onConnect}>
              <IconLink size={14} /> Подключить через OAuth (demo)
            </button>
            <p className="text-center text-[11px] text-ink-lighter">
              В MVP используются моковые данные коммитов и PR для демонстрации.
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

      {/* PRs */}
      <section className="mb-8">
        <h3 className="mb-2 text-sm font-semibold text-ink">Открытые Pull Requests · {prs.length}</h3>
        <div className="divide-y divide-line rounded-md border border-line bg-paper">
          {prs.length === 0 && <div className="px-4 py-3 text-sm text-ink-light">Нет открытых PR</div>}
          {prs.map((pr) => (
            <div key={pr.number} className="flex items-center gap-3 px-4 py-2">
              <span className="chip">#{pr.number}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{pr.title}</div>
                <div className="text-xs text-ink-light">
                  {pr.author} · {formatRelative(pr.createdAt)}
                </div>
              </div>
              <span className="chip">{pr.status}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Commits */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">Последние коммиты · {commits.length}</h3>
        <div className="divide-y divide-line rounded-md border border-line bg-paper">
          {commits.map((c) => (
            <div key={c.sha} className="flex items-center gap-3 px-4 py-2">
              <code className="rounded bg-paper-soft px-1.5 py-0.5 font-mono text-xs text-ink-light">
                {c.sha.slice(0, 7)}
              </code>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-ink">{c.message}</div>
                <div className="text-xs text-ink-light">
                  {c.author} · {formatRelative(c.date)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Confirm
        open={confirmDisc}
        onClose={() => setConfirmDisc(false)}
        onConfirm={() => disconnectGit(projectId)}
        title="Отключить репозиторий?"
        message="Связь с внешним репозиторием будет удалена, но задачи и документы сохранятся."
        destructive
        confirmText="Отключить"
      />
    </div>
  )
}
