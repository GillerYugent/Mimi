// Core domain types for Mimi platform
// Matches the logical data model from practical work #6

export type ID = string
export type ISODate = string

// ─── Users & Auth ────────────────────────────────────────────────
export interface User {
  id: ID
  name: string
  email: string
  avatarUrl?: string
  passwordHash: string // client-side demo: not a real hash, just base64
  createdAt: ISODate
  notificationPrefs: NotificationPrefs
}

export interface NotificationPrefs {
  taskAssigned: boolean
  taskStatusChanged: boolean
  teamInvited: boolean
  mentionedInDoc: boolean
}

export interface Session {
  userId: ID
  accessToken: string // fake JWT-like base64 payload
  refreshToken: string
  issuedAt: ISODate
  expiresAt: ISODate
}

// ─── Projects ────────────────────────────────────────────────────
export type ProjectStatus = 'active' | 'archived'

export interface Project {
  id: ID
  title: string
  description: string
  ownerId: ID
  teamId?: ID
  status: ProjectStatus
  icon?: string // emoji
  gitRepo?: GitRepo
  createdAt: ISODate
  updatedAt: ISODate
}

export interface GitRepo {
  url: string
  provider: 'github' | 'gitlab'
  connectedAt: ISODate
}

// ─── Tasks (Kanban) ──────────────────────────────────────────────
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: ID
  projectId: ID
  parentTaskId?: ID
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  labels: string[]
  assigneeId?: ID
  deadline?: ISODate
  commitSha?: string
  pullRequestUrl?: string
  createdAt: ISODate
  updatedAt: ISODate
  order: number
}

// ─── Docs (Notion-like pages) ────────────────────────────────────
export type BlockType =
  | 'paragraph'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'bulleted_list'
  | 'numbered_list'
  | 'todo'
  | 'quote'
  | 'divider'
  | 'code'
  | 'table'
  | 'image'

export interface Block {
  id: ID
  type: BlockType
  content: string
  checked?: boolean // for todo blocks
  children?: Block[]
}

export interface DocPage {
  id: ID
  title: string
  icon?: string
  projectId?: ID
  mySpaceOwnerId?: ID
  parentPageId?: ID
  blocks: Block[]
  createdAt: ISODate
  updatedAt: ISODate
  createdBy: ID
}

export interface DocVersion {
  id: ID
  pageId: ID
  title: string
  blocks: Block[]
  savedAt: ISODate
  savedBy: ID
}

// ─── Boards (Canvas) ─────────────────────────────────────────────
export type CanvasElementType = 'block' | 'sticker' | 'text' | 'arrow' | 'mind_node'

export interface CanvasElement {
  id: ID
  type: CanvasElementType
  x: number
  y: number
  width: number
  height: number
  text: string
  color?: string // monochrome shades only
  // For arrows
  fromId?: ID
  toId?: ID
}

export interface Canvas {
  id: ID
  title: string
  projectId?: ID
  mySpaceOwnerId?: ID
  elements: CanvasElement[]
  createdAt: ISODate
  updatedAt: ISODate
}

// ─── Teams & Roles ───────────────────────────────────────────────
export interface Team {
  id: ID
  name: string
  ownerId: ID
  memberIds: ID[]
  createdAt: ISODate
}

export interface Role {
  id: ID
  teamId: ID
  name: string // e.g. "Backend", "Frontend", "Designer"
  permissions: RolePermissions
}

export interface RolePermissions {
  canViewDocs: boolean
  canEditDocs: boolean
  canViewTasks: boolean
  canEditTasks: boolean
  canViewBoards: boolean
  canEditBoards: boolean
  canManageTeam: boolean
}

export interface TeamMember {
  teamId: ID
  userId: ID
  roleId?: ID
  joinedAt: ISODate
}

export interface Invitation {
  id: ID
  teamId: ID
  email: string
  status: 'pending' | 'accepted' | 'declined'
  invitedBy: ID
  createdAt: ISODate
}

// ─── Notifications ───────────────────────────────────────────────
export type NotificationType =
  | 'task_assigned'
  | 'task_status_changed'
  | 'team_invited'
  | 'mentioned_in_doc'
  | 'comment_added'

export interface Notification {
  id: ID
  userId: ID
  type: NotificationType
  title: string
  body: string
  link?: string
  isRead: boolean
  createdAt: ISODate
}

// ─── Git (mocked) ────────────────────────────────────────────────
export interface Commit {
  sha: string
  message: string
  author: string
  date: ISODate
}

export interface PullRequest {
  number: number
  title: string
  author: string
  status: 'open' | 'merged' | 'closed'
  createdAt: ISODate
}
