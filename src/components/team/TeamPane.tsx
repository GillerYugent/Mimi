import { useEffect, useMemo, useState } from 'react'
import type { ID, Role, RolePermissions } from '@/types'
import { useTeams } from '@/store/teamStore'
import { useAuth } from '@/store/authStore'
import { useProjects } from '@/store/projectStore'
import { useNotifications } from '@/store/notificationStore'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { IconPlus, IconTrash, IconUsers } from '@/components/ui/Icon'

const PERMISSION_LABELS: Array<{ key: keyof RolePermissions; label: string }> = [
  { key: 'canViewDocs', label: 'Смотреть Docs' },
  { key: 'canEditDocs', label: 'Редактировать Docs' },
  { key: 'canViewTasks', label: 'Смотреть задачи' },
  { key: 'canEditTasks', label: 'Редактировать задачи' },
  { key: 'canViewBoards', label: 'Смотреть канвасы' },
  { key: 'canEditBoards', label: 'Редактировать канвасы' },
  { key: 'canManageTeam', label: 'Управлять командой' },
]

interface Props {
  projectId: ID
}

export function TeamPane({ projectId }: Props) {
  const project = useProjects((s) => s.getProject(projectId))
  const user = useAuth((s) => s.currentUser())
  const upsertPlaceholder = useAuth((s) => s.upsertPlaceholderUser)
  const getUser = useAuth((s) => s.getUser)

  const createTeam = useTeams((s) => s.createTeam)
  const updateProject = useProjects((s) => s.updateProject)
  const team = useTeams((s) => (project?.teamId ? s.getTeam(project.teamId) : undefined))
  const membersByTeam = useTeams((s) => s.membersByTeam)
  const rolesByTeam = useTeams((s) => s.rolesByTeam)
  const addMember = useTeams((s) => s.addMember)
  const removeMember = useTeams((s) => s.removeMember)
  const setMemberRole = useTeams((s) => s.setMemberRole)
  const createRole = useTeams((s) => s.createRole)
  const updateRolePerms = useTeams((s) => s.updateRolePerms)
  const deleteRole = useTeams((s) => s.deleteRole)
  const createInvitation = useTeams((s) => s.createInvitation)
  const invitationsByTeam = useTeams((s) => s.invitationsByTeam)
  const notify = useNotifications((s) => s.notify)

  const [inviteEmail, setInviteEmail] = useState('')
  const [newRoleName, setNewRoleName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [editingRole, setEditingRole] = useState<Role | null>(null)

  // Auto-create a team on first open if none linked to the project.
  useEffect(() => {
    if (!project || !user || project.teamId) return
    const t = createTeam({ name: `${project.title} team`, ownerId: user.id })
    updateProject(project.id, { teamId: t.id })
  }, [project?.id])

  if (!project || !user || !team) return null

  const members = membersByTeam(team.id)
  const roles = rolesByTeam(team.id)
  const pendingInvites = invitationsByTeam(team.id).filter((i) => i.status === 'pending')

  const onInvite = () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    // If user with this email exists — add them as member directly; otherwise create invitation.
    const invited = upsertPlaceholder(email)
    createInvitation({ teamId: team.id, email, invitedBy: user.id })
    addMember(team.id, invited.id)
    notify({
      userId: invited.id,
      type: 'team_invited',
      title: 'Вас пригласили в команду',
      body: `${user.name} пригласил вас в «${team.name}»`,
      link: `/project/${project.id}`,
    })
    setInviteEmail('')
  }

  const onCreateRole = () => {
    if (!newRoleName.trim()) return
    createRole(team.id, newRoleName.trim())
    setNewRoleName('')
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="title-serif text-2xl font-bold tracking-tight text-ink">Команда</h2>
          <p className="mt-0.5 text-sm text-ink-light">Участники проекта, роли и права доступа</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input max-w-[240px] text-sm"
            placeholder={team.name}
            value={teamName || team.name}
            onChange={(e) => setTeamName(e.target.value)}
            onBlur={() => {
              if (teamName && teamName !== team.name) {
                useTeams.getState().renameTeam(team.id, teamName)
              }
            }}
          />
        </div>
      </div>

      {/* Invite */}
      <section className="mb-8 rounded-md border border-line bg-paper p-4">
        <div className="mb-2 text-sm font-semibold text-ink">Пригласить участника</div>
        <div className="flex gap-2">
          <input
            type="email"
            className="input flex-1"
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onInvite()
            }}
          />
          <button className="btn btn-primary text-sm" onClick={onInvite} disabled={!inviteEmail.trim()}>
            <IconPlus size={14} /> Пригласить
          </button>
        </div>
        {pendingInvites.length > 0 && (
          <div className="mt-3 text-xs text-ink-lighter">
            Ожидают ответа: {pendingInvites.map((p) => p.email).join(', ')}
          </div>
        )}
      </section>

      {/* Members */}
      <section className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <IconUsers size={14} className="text-ink-light" />
          <h3 className="text-sm font-semibold text-ink">Участники · {members.length}</h3>
        </div>
        <div className="divide-y divide-line rounded-md border border-line bg-paper">
          {members.map((m) => {
            const u = getUser(m.userId)
            const role = m.roleId ? roles.find((r) => r.id === m.roleId) : undefined
            const isOwner = m.userId === team.ownerId
            return (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-paper">
                  {u?.name.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">
                    {u?.name || 'Неизвестный'} {isOwner && <span className="chip ml-1">владелец</span>}
                  </div>
                  <div className="truncate text-xs text-ink-light">{u?.email}</div>
                </div>
                <select
                  className="input w-auto py-1 text-xs"
                  value={m.roleId || ''}
                  onChange={(e) => setMemberRole(team.id, m.userId, e.target.value || undefined)}
                  disabled={isOwner}
                >
                  <option value="">— без роли —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {!isOwner && (
                  <button
                    className="rounded p-1 text-ink-lighter hover:bg-paper-hover hover:text-red-600"
                    onClick={() => removeMember(team.id, m.userId)}
                    aria-label="Исключить"
                  >
                    <IconTrash size={14} />
                  </button>
                )}
                {role && (
                  <span className="shrink-0 chip ml-1" title="Текущая роль">
                    {role.name}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Roles */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Роли · {roles.length}</h3>
        </div>
        <div className="mb-3 rounded-md border border-line bg-paper">
          {roles.map((r, idx) => (
            <div
              key={r.id}
              className={`flex items-center gap-2 px-4 py-2 ${idx > 0 ? 'border-t border-line' : ''}`}
            >
              <input
                className="input flex-1 text-sm"
                defaultValue={r.name}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next && next !== r.name) {
                    useTeams.setState({
                      roles: useTeams.getState().roles.map((x) =>
                        x.id === r.id ? { ...x, name: next } : x
                      ),
                    })
                  }
                }}
              />
              <button className="btn btn-ghost text-xs" onClick={() => setEditingRole(r)}>
                Права
              </button>
              <button
                className="rounded p-1 text-ink-lighter hover:bg-paper-hover hover:text-red-600"
                onClick={() => deleteRole(r.id)}
                aria-label="Удалить роль"
              >
                <IconTrash size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Название новой роли"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCreateRole()
            }}
            className="flex-1"
          />
          <button className="btn btn-outline text-sm" onClick={onCreateRole}>
            <IconPlus size={14} /> Создать роль
          </button>
        </div>
      </section>

      <Modal
        open={!!editingRole}
        onClose={() => setEditingRole(null)}
        title={editingRole ? `Права роли: ${editingRole.name}` : ''}
        width="sm"
      >
        {editingRole && (
          <div className="space-y-1">
            {PERMISSION_LABELS.map(({ key, label }) => {
              const role = rolesByTeam(team.id).find((r) => r.id === editingRole.id)
              if (!role) return null
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-paper-hover"
                >
                  <span className="text-sm text-ink">{label}</span>
                  <input
                    type="checkbox"
                    checked={role.permissions[key]}
                    onChange={(e) =>
                      updateRolePerms(role.id, { [key]: e.target.checked } as Partial<RolePermissions>)
                    }
                  />
                </label>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
