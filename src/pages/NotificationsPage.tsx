import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Topbar } from '@/components/layout/Topbar'
import { useAuth } from '@/store/authStore'
import { useNotifications } from '@/store/notificationStore'
import { useTeams } from '@/store/teamStore'
import { useProjects } from '@/store/projectStore'
import { IconBell, IconTrash } from '@/components/ui/Icon'
import { formatRelative } from '@/utils/date'
import type { Notification } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  task_assigned: 'Назначена задача',
  task_status_changed: 'Изменён статус',
  team_invited: 'Приглашение в команду',
  mentioned_in_doc: 'Упоминание в документе',
  comment_added: 'Новый комментарий',
}

export function NotificationsPage() {
  const user = useAuth((s) => s.user)
  const items = useNotifications((s) => s.items)
  const markAllRead = useNotifications((s) => s.markAllRead)
  const markRead = useNotifications((s) => s.markRead)
  const clearRead = useNotifications((s) => s.clearRead)
  const remove = useNotifications((s) => s.remove)
  const acceptInvitation = useTeams((s) => s.acceptInvitation)
  const declineInvitation = useTeams((s) => s.declineInvitation)
  const loadAllTeams = useTeams((s) => s.loadAll)
  const loadAllProjects = useProjects((s) => s.loadAll)
  const navigate = useNavigate()

  if (!user) return <Navigate to="/login" replace />

  return (
    <Layout>
      <Topbar
        breadcrumbs={<span className="px-1.5 font-medium text-ink">Уведомления</span>}
        actions={
          <>
            <button className="btn btn-ghost text-xs" onClick={() => markAllRead()}>
              Отметить всё прочитанным
            </button>
            <button className="btn btn-ghost text-xs" onClick={() => clearRead()}>
              Очистить прочитанные
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-paper-soft py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-paper-hover text-ink-light">
                <IconBell size={20} />
              </div>
              <h3 className="text-base font-semibold text-ink">Нет уведомлений</h3>
              <p className="mt-1 max-w-xs text-sm text-ink-light">
                Здесь появятся события по задачам, приглашения в команды и упоминания.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line rounded-md border border-line bg-paper">
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  n={n}
                  userEmail={user.email}
                  onMarkRead={() => markRead(n.id)}
                  onRemove={() => remove(n.id)}
                  onNavigate={(link) => { markRead(n.id); navigate(link) }}
                  onAccept={async (invId) => {
                    await acceptInvitation(invId, user.email)
                    markRead(n.id)
                    await Promise.all([loadAllTeams(), loadAllProjects()])
                  }}
                  onDecline={async (invId) => {
                    await declineInvitation(invId, user.email)
                    markRead(n.id)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

// ─── NotificationItem ─────────────────────────────────────────────────────────

interface ItemProps {
  n: Notification
  userEmail: string
  onMarkRead: () => void
  onRemove: () => void
  onNavigate: (link: string) => void
  onAccept: (invitationId: string) => Promise<void>
  onDecline: (invitationId: string) => Promise<void>
}

function NotificationItem({ n, onMarkRead, onRemove, onNavigate, onAccept, onDecline }: ItemProps) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)

  // Extract invitation ID from link like "/invitations/{id}/accept"
  const invitationId = n.type === 'team_invited' && n.link
    ? n.link.replace('/invitations/', '').replace('/accept', '')
    : null

  const isTeamInvite = n.type === 'team_invited' && !!invitationId

  const handle = (action: 'accept' | 'decline') => async () => {
    if (busy || !invitationId) return
    setBusy(action)
    try {
      if (action === 'accept') await onAccept(invitationId)
      else await onDecline(invitationId)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 transition-colors ${!n.isRead ? 'bg-paper-soft' : ''}`}>
      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-paper-active' : 'bg-ink'}`} />
      <div
        className={`min-w-0 flex-1 ${!isTeamInvite ? 'cursor-pointer' : ''}`}
        onClick={() => {
          if (!isTeamInvite) {
            onMarkRead()
            if (n.link) onNavigate(n.link)
          }
        }}
      >
        <div className="flex items-center gap-2">
          <span className="chip">{TYPE_LABELS[n.type] || n.type}</span>
          <span className="text-[11px] text-ink-lighter">{formatRelative(n.createdAt)}</span>
        </div>
        <div className="mt-0.5 text-sm font-medium text-ink">{n.title}</div>
        {n.body && <div className="mt-0.5 text-sm text-ink-light">{n.body}</div>}
        {isTeamInvite && (
          <div className="mt-2 flex gap-2">
            <button
              className="btn btn-primary text-xs"
              disabled={!!busy}
              onClick={handle('accept')}
            >
              {busy === 'accept' ? 'Принятие…' : 'Принять'}
            </button>
            <button
              className="btn btn-ghost text-xs"
              disabled={!!busy}
              onClick={handle('decline')}
            >
              {busy === 'decline' ? 'Отклонение…' : 'Отклонить'}
            </button>
          </div>
        )}
      </div>
      <button
        className="rounded p-1 text-ink-lighter hover:bg-paper-hover hover:text-red-600"
        onClick={onRemove}
        aria-label="Удалить"
      >
        <IconTrash size={14} />
      </button>
    </div>
  )
}
