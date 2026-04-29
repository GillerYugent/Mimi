import { create } from 'zustand'
import type { Invitation, Role, RolePermissions, Team, TeamMember } from '@/types'
import { teamsApi } from '@/api/teams'

interface TeamState {
  teams: Record<string, Team>
  rolesByTeamCache: Record<string, string[]>
  rolesById: Record<string, Role>
  membersByTeam: Record<string, TeamMember[]>
  invitationsByTeamCache: Record<string, Invitation[]>

  loadAll: () => Promise<void>
  loadTeam: (teamId: string) => Promise<void>

  createTeam: (input: { name: string; ownerId?: string }) => Promise<Team>
  renameTeam: (teamId: string, name: string) => Promise<void>
  deleteTeam: (teamId: string) => Promise<void>
  getTeam: (id: string) => Team | undefined
  teamsByUser: (userId?: string) => Team[]

  createRole: (teamId: string, name: string, perms?: Partial<RolePermissions>) => Promise<Role>
  updateRole: (roleId: string, updates: { name?: string; permissions?: Partial<RolePermissions> }) => Promise<void>
  updateRolePerms: (roleId: string, perms: Partial<RolePermissions>) => Promise<void>
  deleteRole: (roleId: string) => Promise<void>
  rolesByTeam: (teamId: string) => Role[]
  getRole: (id: string) => Role | undefined

  setMemberRole: (teamId: string, userId: string, roleId: string | undefined) => Promise<void>
  removeMember: (teamId: string, userId: string) => Promise<void>
  // addMember больше не вызывается напрямую — flow через invitations
  addMember: (teamId: string, userId: string, roleId?: string) => Promise<void>
  membersOf: (teamId: string) => TeamMember[]
  memberOf: (teamId: string, userId: string) => TeamMember | undefined

  createInvitation: (input: { teamId: string; email: string; invitedBy?: string }) => Promise<Invitation>
  acceptInvitation: (id: string, email: string) => Promise<void>
  declineInvitation: (id: string, email: string) => Promise<void>
  invitationsByTeam: (teamId: string) => Invitation[]
  invitationsForUser: (email: string) => Promise<Invitation[]>

  reset: () => void
}

export const useTeams = create<TeamState>((set, get) => ({
  teams: {},
  rolesByTeamCache: {},
  rolesById: {},
  membersByTeam: {},
  invitationsByTeamCache: {},

  loadAll: async () => {
    const list = await teamsApi.list()
    const map: Record<string, Team> = {}
    for (const t of list) map[t.id] = t
    set({ teams: map })
  },

  loadTeam: async (teamId) => {
    const [team, roles, members, invitations] = await Promise.all([
      teamsApi.byId(teamId),
      teamsApi.roles(teamId),
      teamsApi.members(teamId),
      teamsApi.invitations(teamId).catch(() => [] as Invitation[]),
    ])
    const rolesById = { ...get().rolesById }
    for (const r of roles) rolesById[r.id] = r
    set({
      teams: { ...get().teams, [team.id]: team },
      rolesByTeamCache: { ...get().rolesByTeamCache, [teamId]: roles.map((r) => r.id) },
      rolesById,
      membersByTeam: { ...get().membersByTeam, [teamId]: members },
      invitationsByTeamCache: { ...get().invitationsByTeamCache, [teamId]: invitations },
    })
  },

  createTeam: async ({ name }) => {
    const t = await teamsApi.create(name)
    set({ teams: { ...get().teams, [t.id]: t } })
    await get().loadTeam(t.id)
    return t
  },

  renameTeam: async (teamId, name) => {
    const t = await teamsApi.rename(teamId, name)
    set({ teams: { ...get().teams, [teamId]: t } })
  },

  deleteTeam: async (teamId) => {
    await teamsApi.delete(teamId)
    const teams = { ...get().teams }
    delete teams[teamId]
    set({ teams })
  },

  getTeam: (id) => get().teams[id],
  teamsByUser: () => Object.values(get().teams),

  createRole: async (teamId, name, perms) => {
    const r = await teamsApi.createRole(teamId, name, perms)
    set({
      rolesById: { ...get().rolesById, [r.id]: r },
      rolesByTeamCache: {
        ...get().rolesByTeamCache,
        [teamId]: [...(get().rolesByTeamCache[teamId] || []), r.id],
      },
    })
    return r
  },

  updateRole: async (roleId, updates) => {
    const r = await teamsApi.updateRole(roleId, updates)
    set({ rolesById: { ...get().rolesById, [roleId]: r } })
  },

  updateRolePerms: async (roleId, perms) => {
    const r = await teamsApi.updateRole(roleId, { permissions: perms })
    set({ rolesById: { ...get().rolesById, [roleId]: r } })
  },

  deleteRole: async (roleId) => {
    await teamsApi.deleteRole(roleId)
    const role = get().rolesById[roleId]
    const rolesById = { ...get().rolesById }
    delete rolesById[roleId]
    const rolesByTeamCache = { ...get().rolesByTeamCache }
    if (role) {
      rolesByTeamCache[role.teamId] = (rolesByTeamCache[role.teamId] || []).filter((x) => x !== roleId)
    }
    set({ rolesById, rolesByTeamCache })
  },

  rolesByTeam: (teamId) => (get().rolesByTeamCache[teamId] || []).map((id) => get().rolesById[id]).filter(Boolean),
  getRole: (id) => get().rolesById[id],

  addMember: async () => {
    // На бэке прямого "добавить участника по userID" нет — flow через invitations.accept.
    // Метод оставлен для совместимости; ничего не делает.
  },

  removeMember: async (teamId, userId) => {
    await teamsApi.removeMember(teamId, userId)
    set({
      membersByTeam: {
        ...get().membersByTeam,
        [teamId]: (get().membersByTeam[teamId] || []).filter((m) => m.userId !== userId),
      },
    })
  },

  setMemberRole: async (teamId, userId, roleId) => {
    const m = await teamsApi.setMemberRole(teamId, userId, roleId ?? null)
    set({
      membersByTeam: {
        ...get().membersByTeam,
        [teamId]: (get().membersByTeam[teamId] || []).map((x) =>
          x.userId === userId ? m : x
        ),
      },
    })
  },

  membersOf: (teamId) => get().membersByTeam[teamId] || [],
  memberOf: (teamId, userId) => (get().membersByTeam[teamId] || []).find((m) => m.userId === userId),

  createInvitation: async ({ teamId, email }) => {
    const inv = await teamsApi.invite(teamId, email)
    set({
      invitationsByTeamCache: {
        ...get().invitationsByTeamCache,
        [teamId]: [inv, ...(get().invitationsByTeamCache[teamId] || [])],
      },
    })
    return inv
  },

  acceptInvitation: async (id, email) => {
    await teamsApi.accept(id, email)
  },

  declineInvitation: async (id, email) => {
    await teamsApi.decline(id, email)
  },

  invitationsByTeam: (teamId) => get().invitationsByTeamCache[teamId] || [],
  invitationsForUser: (email) => teamsApi.pendingForEmail(email),

  reset: () =>
    set({
      teams: {},
      rolesByTeamCache: {},
      rolesById: {},
      membersByTeam: {},
      invitationsByTeamCache: {},
    }),
}))
