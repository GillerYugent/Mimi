import type { ID } from '@/types'
import { useProjects } from '@/store/projectStore'
import { useTasks } from '@/store/taskStore'
import { useDocs } from '@/store/docStore'
import { useBoards } from '@/store/boardStore'
import { useTeams } from '@/store/teamStore'
import { useAuth } from '@/store/authStore'
import { Textarea } from '@/components/ui/Input'
import { formatRelative } from '@/utils/date'

interface Props {
  projectId: ID
}

export function OverviewPane({ projectId }: Props) {
  const project = useProjects((s) => s.getProject(projectId))
  const updateProject = useProjects((s) => s.updateProject)
  const stats = useTasks((s) => s.stats(projectId))
  const tasks = useTasks((s) => s.byProject(projectId))
  const docs = useDocs((s) => s.pages.filter((p) => p.projectId === projectId))
  const canvases = useBoards((s) => s.list({ projectId }))
  const team = useTeams((s) => (project?.teamId ? s.getTeam(project.teamId) : undefined))
  const members = useTeams((s) => (team ? s.membersByTeam(team.id) : []))
  const getUser = useAuth((s) => s.getUser)

  if (!project) return null

  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-paper-soft text-3xl">
          {project.icon || '📁'}
        </div>
        <div className="flex-1">
          <input
            className="title-serif w-full border-none bg-transparent text-3xl font-bold tracking-tight text-ink outline-none"
            value={project.title}
            onChange={(e) => updateProject(projectId, { title: e.target.value })}
          />
          <div className="mt-1 text-xs text-ink-lighter">
            Создан {formatRelative(project.createdAt)} · Обновлён {formatRelative(project.updatedAt)}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Всего задач" value={stats.total} />
        <StatCard label="В работе" value={stats.inProgress} />
        <StatCard label="Готово" value={stats.done} />
        <StatCard label="Просрочено" value={stats.overdue} tone={stats.overdue > 0 ? 'warn' : undefined} />
      </div>

      <section className="mb-6">
        <h3 className="mb-1 text-sm font-semibold text-ink">Описание</h3>
        <Textarea
          rows={4}
          value={project.description}
          onChange={(e) => updateProject(projectId, { description: e.target.value })}
          placeholder="О чём этот проект? Цели, контекст, ссылки..."
        />
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink">Последние задачи</h3>
          <div className="card divide-y divide-line">
            {tasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="chip">{t.status}</span>
                <span className="truncate">{t.title}</span>
              </div>
            ))}
            {tasks.length === 0 && <div className="px-3 py-2 text-sm text-ink-light">Задач ещё нет</div>}
          </div>
        </section>
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink">Документы и канвасы</h3>
          <div className="card divide-y divide-line">
            <div className="flex items-center justify-between px-3 py-2 text-sm">
              <span>Страниц Docs</span>
              <span className="text-ink-light">{docs.length}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-sm">
              <span>Канвасов</span>
              <span className="text-ink-light">{canvases.length}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-sm">
              <span>Участников</span>
              <span className="text-ink-light">{members.length}</span>
            </div>
          </div>
        </section>
      </div>

      {members.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-1 text-sm font-semibold text-ink">Команда</h3>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const u = getUser(m.userId)
              return (
                <div
                  key={m.userId}
                  className="flex items-center gap-2 rounded-full border border-line bg-paper px-2 py-1"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] font-medium text-paper">
                    {u?.name.charAt(0).toUpperCase() || '?'}
                  </div>
                  <span className="text-xs text-ink">{u?.name || 'Неизвестный'}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-ink-light">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === 'warn' && value > 0 ? 'text-red-600' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  )
}
