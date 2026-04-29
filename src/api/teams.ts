import type { Invitation, Role, RolePermissions, Team, TeamMember } from '@/types'
import { get, post, patch, del } from './client'

export const teamsApi = {
  list: () => get<Team[]>('/teams'),
  create: (name: string) => post<Team>('/teams', { name }),
  byId: (id: string) => get<Team>(`/teams/${id}`),
  rename: (id: string, name: string) => patch<Team>(`/teams/${id}`, { name }),
  delete: (id: string) => del<void>(`/teams/${id}`),

  // Roles
  roles: (teamId: string) => get<Role[]>(`/teams/${teamId}/roles`),
  createRole: (teamId: string, name: string, permissions?: Partial<RolePermissions>) =>
    post<Role>(`/teams/${teamId}/roles`, { name, permissions }),
  updateRole: (roleId: string, updates: { name?: string; permissions?: Partial<RolePermissions> }) =>
    patch<Role>(`/teams/roles/${roleId}`, updates),
  deleteRole: (roleId: string) => del<void>(`/teams/roles/${roleId}`),

  // Members
  members: (teamId: string) => get<TeamMember[]>(`/teams/${teamId}/members`),
  setMemberRole: (teamId: string, userId: string, roleId: string | null) =>
    patch<TeamMember>(`/teams/${teamId}/members/${userId}`, { roleId }),
  removeMember: (teamId: string, userId: string) => del<void>(`/teams/${teamId}/members/${userId}`),

  // Invitations
  invite: (teamId: string, email: string) =>
    post<Invitation>(`/teams/${teamId}/invitations`, { email }),
  invitations: (teamId: string) => get<Invitation[]>(`/teams/${teamId}/invitations`),
  pendingForEmail: (email: string) =>
    get<Invitation[]>(`/invitations?email=${encodeURIComponent(email)}`),
  accept: (id: string, email: string) =>
    post<void>(`/invitations/${id}/accept?email=${encodeURIComponent(email)}`),
  decline: (id: string, email: string) =>
    post<void>(`/invitations/${id}/decline?email=${encodeURIComponent(email)}`),
  cancelInvitation: (id: string) => del<void>(`/invitations/${id}`),
}
