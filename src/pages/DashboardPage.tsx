import { useEffect } from 'react'
import { Layout } from '@/components/layout/Layout'
import { Topbar } from '@/components/layout/Topbar'
import { useAuth } from '@/store/authStore'
import { useProjects } from '@/store/projectStore'
import { useTasks } from '@/store/taskStore'
import { Link, Navigate } from 'react-router-dom'
import { formatRelative } from '@/utils/date'
import { IconFolder, IconPlus } from '@/components/ui/Icon'

export function DashboardPage() {
  const user = useAuth((s) => s.user)
  const mySpaceProjectId = useAuth((s) => s.mySpaceProjectId)
  const projects = useProjects((s) => s.listActive()).filter((p) => p.id !== mySpaceProjectId)
  const loadStats = useTasks((s) => s.loadStats)
  const statsByProject = useTasks((s) => s.statsByProject)

  // Прогрузим stats для каждого проекта в фоне.
  useEffect(() => {
    for (const p of projects) {
      void loadStats(p.id)
    }
  }, [projects.length])

  if (!user) return <Navigate to="/login" replace />

  return (
    <Layout>
      <Topbar breadcrumbs={<span className="px-1.5 font-medium text-ink">Dashboard</span>} />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-10 py-10">
          <h1 className="title-serif mb-1 text-3xl font-bold tracking-tight text-ink">
            Добрый день, {user.name.split(' ')[0]}
          </h1>
          <p className="mb-8 text-sm text-ink-light">Все ваши проекты и последние изменения</p>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-light">Проекты</h2>
          </div>

          {projects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => {
                const s = statsByProject[p.id] ?? { total: 0, inProgress: 0, done: 0, overdue: 0 }
                return (
                  <Link
                    key={p.id}
                    to={`/project/${p.id}`}
                    className="group flex flex-col rounded-md border border-line bg-paper p-4 transition-all hover:shadow-notion"
                  >
                    <div className="mb-2 flex items-start gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-paper-soft text-lg">
                        {p.icon || <IconFolder />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">{p.title}</div>
                        <div className="truncate text-xs text-ink-light">
                          Обновлён {formatRelative(p.updatedAt)}
                        </div>
                      </div>
                    </div>
                    {p.description && (
                      <p className="mb-3 line-clamp-2 text-xs text-ink-light">{p.description}</p>
                    )}
                    <div className="mt-auto flex items-center gap-3 border-t border-line pt-2 text-[11px] text-ink-light">
                      <span>{s.total} задач</span>
                      <span>•</span>
                      <span>{s.inProgress} в работе</span>
                      <span>•</span>
                      <span>{s.done} готово</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-paper-soft py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-paper-hover text-ink-light">
        <IconFolder size={20} />
      </div>
      <h3 className="text-base font-semibold text-ink">Нет проектов</h3>
      <p className="mt-1 max-w-xs text-sm text-ink-light">
        Создайте первый проект, чтобы объединить задачи, документы и канвасы в одном месте.
      </p>
      <div className="mt-4 text-xs text-ink-lighter">
        <IconPlus size={12} className="inline" /> в меню слева — создать новый проект
      </div>
    </div>
  )
}
