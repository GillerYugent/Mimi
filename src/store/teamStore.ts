import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ID, Invitation, Role, RolePermissions, Team, TeamMember } from '@/types'
import { uid } from '@/utils/id'

const DEFAULT_PERMS: RolePermissions = {
  canViewDocs: true,
  canEditDocs: true,
  canViewTasks: true,
  canEditTasks: true,
  canViewBoards: true,
  canEditBoards: true,
  canManageTeam: false,
}

interface TeamState {
  teams: Team[]
  roles: Role[]
  members: TeamMember[]
  invitations: Invitation[]

  createTeam: (input: { name: string; ownerId: ID }) => Team
  renameTeam: (teamId: ID, name: string) => void
  deleteTeam: (teamId: ID) => void
  getTeam: (id: ID) => Team | undefined
  teamsByUser: (userId: ID) => Team[]

  createRole: (teamId: ID, name: string, perms?: Partial<RolePermissions>) => Role
  updateRolePerms: (roleId: ID, perms: Partial<RolePermissions>) => void
  deleteRole: (roleId: ID) => void
  rolesByTeam: (teamId: ID) => Role[]
  getRole: (id: ID) => Role | undefined

  addMember: (teamId: ID, userId: ID, roleId?: ID) => void
  removeMember: (teamId: ID, userId: ID) => void
  setMemberRole: (teamId: ID, userId: ID, roleId: ID | undefined) => void
  membersByTeam: (teamId: ID) => TeamMember[]
  memberOf: (teamId: ID, userId: ID) => TeamMember | undefined

  createInvitation: (input: { teamId: ID; email: string; invitedBy: ID }) => Invitation
  acceptInvitation: (id: ID, userId: ID) => void
  declineInvitation: (id: ID) => void
  invitationsByTeam: (teamId: ID) => Invitation[]
  invitationsForUser: (email: string) => Invitation[]
}

const PRESET_ROLES: Array<{ name: string; perms?: Partial<RolePermissions> }> = [
  { name: 'Backend', perms: {} },
  { name: 'Frontend', perms: {} },
  { name: 'Designer', perms: { canEditTasks: false } },
  { name: 'QA', perms: { canEditDocs: false, canEditBoards: false } },
]

export const useTeams = create<TeamState>()(
  persist(
    (set, get) => ({
      teams: [],
      roles: [],
      members: [],
      invitations: [],

      createTeam: ({ name, ownerId }) => {
        const now = new Date().toISOString()
        const team: Team = {
          id: uid('team'),
          name: name.trim() || 'Моя команда',
          ownerId,
          memberIds: [ownerId],
          createdAt: now,
        }
        set({ teams: [...get().teams, team] })
        // Owner joins as member
        set({ members: [...get().members, { teamId: team.id, userId: ownerId, joinedAt: now }] })
        // Create preset roles
        for (const pr of PRESET_ROLES) {
          get().createRole(team.id, pr.name, pr.perms)
        }
        return team
      },

      renameTeam: (teamId, name) => {
        set({
          teams: get().teams.map((t) => (t.id === teamId ? { ...t, name: name || 'Без названия' } : t)),
        })
      },

      deleteTeam: (teamId) => {
        set({
          teams: get().teams.filter((t) => t.id !== teamId),
          roles: get().roles.filter((r) => r.teamId !== teamId),
          members: get().members.filter((m) => m.teamId !== teamId),
          invitations: get().invitations.filter((i) => i.teamId !== teamId),
        })
      },

      getTeam: (id) => get().teams.find((t) => t.id === id),

      teamsByUser: (userId) =>
        get().teams.filter((t) => t.memberIds.includes(userId) || t.ownerId === userId),

      createRole: (teamId, name, perms) => {
        const role: Role = {
          id: uid('role'),
          teamId,
          name: name.trim() || 'Роль',
          permissions: { ...DEFAULT_PERMS, ...perms },
        }
        set({ roles: [...get().roles, role] })
        return role
      },

      updateRolePerms: (roleId, perms) => {
        set({
          roles: get().roles.map((r) =>
            r.id === roleId ? { ...r, permissions: { ...r.permissions, ...perms } } : r
          ),
        })
      },

      deleteRole: (roleId) => {
        set({
          roles: get().roles.filter((r) => r.id !== roleId),
          members: get().members.map((m) => (m.roleId === roleId ? { ...m, roleId: undefined } : m)),
        })
      },

      rolesByTeam: (teamId) => get().roles.filter((r) => r.teamId === teamId),

      getRole: (id) => get().roles.find((r) => r.id === id),

      addMember: (teamId, userId, roleId) => {
        const existing = get().members.find((m) => m.teamId === teamId && m.userId === userId)
        if (existing) return
        set({
          members: [...get().members, { teamId, userId, roleId, joinedAt: new Date().toISOString() }],
          teams: get().teams.map((t) =>
            t.id === teamId && !t.memberIds.includes(userId)
              ? { ...t, memberIds: [...t.memberIds, userId] }
              : t
          ),
        })
      },

      removeMember: (teamId, userId) => {
        set({
          members: get().members.filter((m) => !(m.teamId === teamId && m.userId === userId)),
          teams: get().teams.map((t) =>
            t.id === teamId ? { ...t, memberIds: t.memberIds.filter((id) => id !== userId) } : t
          ),
        })
      },

      setMemberRole: (teamId, userId, roleId) => {
        set({
          members: get().members.map((m) =>
            m.teamId === teamId && m.userId === userId ? { ...m, roleId } : m
          ),
        })
      },

      membersByTeam: (teamId) => get().members.filter((m) => m.teamId === teamId),

      memberOf: (teamId, userId) =>
        get().members.find((m) => m.teamId === teamId && m.userId === userId),

      createInvitation: ({ teamId, email, invitedBy }) => {
        const inv: Invitation = {
          id: uid('inv'),
          teamId,
          email: email.trim().toLowerCase(),
          status: 'pending',
          invitedBy,
          createdAt: new Date().toISOString(),
        }
        set({ invitations: [...get().invitations, inv] })
        return inv
      },

      acceptInvitation: (id, userId) => {
        const inv = get().invitations.find((i) => i.id === id)
        if (!inv) return
        set({
          invitations: get().invitations.map((i) => (i.id === id ? { ...i, status: 'accepted' } : i)),
        })
        get().addMember(inv.teamId, userId)
      },

      declineInvitation: (id) => {
        set({
          invitations: get().invitations.map((i) => (i.id === id ? { ...i, status: 'declined' } : i)),
        })
      },

      invitationsByTeam: (teamId) => get().invitations.filter((i) => i.teamId === teamId),

      invitationsForUser: (email) => {
        const e = email.trim().toLowerCase()
        return get().invitations.filter((i) => i.email === e && i.status === 'pending')
      },
    }),
    { name: 'mimi.teams' }
  )
)
