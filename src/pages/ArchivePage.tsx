import { Navigate, useNavigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Topbar } from '@/components/layout/Topbar'
import { useAuth } from '@/store/authStore'
import { useProjects } from '@/store/projectStore'
import { IconArchive, IconFolder, IconTrash } from '@/components/ui/Icon'
import { formatRelative } from '@/utils/date'
import { useState } from 'react'
import { Confirm } from '@/components/ui/Modal'

export function ArchivePage() {
  const user = useAuth((s) => s.currentUser())
  const archived = useProjects((s) => (user ? s.listArchived(user.id) : []))
  const restore = useProjects((s) => s.restoreProject)
  const remove = useProjects((s) => s.deleteProject)
  const navigate = useNavigate()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  if (!user) return <Navigate to="/login" replace />

  return (
    <Layout>
      <Topbar breadcrumbs={<span className="px-1.5 font-medium text-ink">Архив</span>} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-6">
          <div className="mb-1 flex items-center gap-2">
            <IconArchive size={16} className="text-ink-light" />
            <h1 className="title-serif text-2xl font-bold tracking-tight text-ink">Архив проектов</h1>
          </div>
          <p className="mb-6 text-sm text-ink-light">
            Проекты, которые не отображаются в основном списке. Их можно восстановить или удалить.
          </p>

          {archived.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-paper-soft py-16 text-center">
              <IconFolder size={20} className="text-ink-light" />
              <p className="mt-2 text-sm text-ink-light">Архив пуст</p>
            </div>
          ) : (
            <div className="divide-y divide-line rounded-md border border-line bg-paper">
              {archived.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-paper-soft text-lg">
                    {p.icon || <IconFolder />}
                  </div>
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => {
                      restore(p.id)
                      navigate(`/project/${p.id}`)
                    }}
                  >
                    <div className="truncate text-sm font-medium text-ink">{p.title}</div>
                    <div className="text-xs text-ink-light">
                      Архивирован {formatRelative(p.updatedAt)}
                    </div>
                  </div>
                  <button
                    className="btn btn-outline text-xs"
                    onClick={() => {
                      restore(p.id)
                      navigate(`/project/${p.id}`)
                    }}
                  >
                    Восстановить
                  </button>
                  <button
                    className="rounded p-1 text-ink-lighter hover:bg-paper-hover hover:text-red-600"
                    onClick={() => setPendingDelete(p.id)}
                    aria-label="Удалить навсегда"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Confirm
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove(pendingDelete)
        }}
        title="Удалить проект навсегда?"
        message="Задачи, документы и канвасы этого проекта будут удалены безвозвратно."
        confirmText="Удалить"
        destructive
      />
    </Layout>
  )
}
