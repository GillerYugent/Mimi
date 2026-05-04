import { useEffect, useState } from 'react'
import type { ID, Role, RolePermissions } from '@/types'
import { useTeams } from '@/store/teamStore'
import { useAuth } from '@/store/authStore'
import { useProjects } from '@/store/projectStore'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
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
  const updateProject = useProjects((s) => s.updateProject)
  const user = useAuth((s) => s.user)
  const fetchUsers = useAuth((s) => s.fetchUsers)
  // Subscribe to publicUsers directly — getUser is a stable function reference
  // and won't trigger re-renders when the cache fills in.
  const publicUsers = useAuth((s) => s.publicUsers)
  const getUser = (id: string) => {
    if (user?.id === id) return user
    const p = publicUsers[id]
    if (!p) return undefined
    return {
      id: p.id, name: p.name, email: p.email, avatarUrl: p.avatarUrl,
      passwordHash: '', createdAt: p.createdAt,
      notificationPrefs: { taskAssigned: true, taskStatusChanged: true, teamInvited: true, mentionedInDoc: true },
    }
  }

  const team = useTeams((s) => (project?.teamId ? s.getTeam(project.teamId) : undefined))
  const createTeam = useTeams((s) => s.createTeam)
  const renameTeam = useTeams((s) => s.renameTeam)
  const loadTeam = useTeams((s) => s.loadTeam)
  const membersOf = useTeams((s) => s.membersOf)
  const rolesByTeam = useTeams((s) => s.rolesByTeam)
  const removeMember = useTeams((s) => s.removeMember)
  const setMemberRole = useTeams((s) => s.setMemberRole)
  const createRole = useTeams((s) => s.createRole)
  const updateRole = useTeams((s) => s.updateRole)
  const updateRolePerms = useTeams((s) => s.updateRolePerms)
  const deleteRole = useTeams((s) => s.deleteRole)
  const createInvitation = useTeams((s) => s.createInvitation)
  const invitationsByTeam = useTeams((s) => s.invitationsByTeam)

  const [inviteEmail, setInviteEmail] = useState('')
  const [newRoleName, setNewRoleName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [creatingTeam, setCreatingTeam] = useState(false)

  // Авто-создание команды для проекта при первом открытии вкладки.
  useEffect(() => {
    if (!project || !user) return
    if (project.teamId) {
      void loadTeam(project.teamId)
      return
    }
    if (creatingTeam) return
    setCreatingTeam(true)
    void (async () => {
      try {
        const t = await createTeam({ name: `${project.title} team` })
        await updateProject(project.id, { teamId: t.id })
      } finally {
        setCreatingTeam(false)
      }
    })()
  }, [project?.id, project?.teamId])

  // Прокачиваем кэш профилей участников.
  const members = team ? membersOf(team.id) : []
  useEffect(() => {
    if (members.length) void fetchUsers(members.map((m) => m.userId))
  }, [members.length])

  if (!project || !user) return null
  if (!team) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-6 text-sm text-ink-light">Создаём команду…</div>
    )
  }

  const roles = rolesByTeam(team.id)
  const pendingInvites = invitationsByTeam(team.id).filter((i) => i.status === 'pending')

  const onInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    await createInvitation({ teamId: team.id, email })
    setInviteEmail('')
  }

  const onCreateRole = async () => {
    if (!newRoleName.trim()) return
    await createRole(team.id, newRoleName.trim())
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
            onBlur={async () => {
              if (teamName && teamName !== team.name) {
                await renameTeam(team.id, teamName)
              }
            }}
          />
        </div>
      </div>

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
              if (e.key === 'Enter') void onInvite()
            }}
          />
          <button
            className="btn btn-primary text-sm"
            onClick={onInvite}
            disabled={!inviteEmail.trim()}
          >
            <IconPlus size={14} /> Пригласить
          </button>
        </div>
        {pendingInvites.length > 0 && (
          <div className="mt-3 text-xs text-ink-lighter">
            Ожидают ответа: {pendingInvites.map((p) => p.email).join(', ')}
          </div>
        )}
      </section>

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
                    {u?.name || 'Участник'} {isOwner && <span className="chip ml-1">владелец</span>}
                  </div>
                  <div className="truncate text-xs text-ink-light">{u?.email}</div>
                </div>
                <Select
                  value={m.roleId || ''}
                  onChange={(v) => setMemberRole(team.id, m.userId, v || undefined)}
                  options={roles.map((r) => ({ value: r.id, label: r.name }))}
                  nullable
                  nullLabel="— без роли —"
                  placeholder="— без роли —"
                  size="sm"
                  className="w-auto min-w-[120px]"
                />
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
                    void updateRole(r.id, { name: next })
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
              if (e.key === 'Enter') void onCreateRole()
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
              const role = roles.find((r) => r.id === editingRole.id)
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
