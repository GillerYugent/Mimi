import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Crumb, CrumbSep, Topbar } from '@/components/layout/Topbar'
import { useProjects } from '@/store/projectStore'
import { useAuth } from '@/store/authStore'
import { useTeams } from '@/store/teamStore'
import { useMemo, useState } from 'react'
import { OverviewPane } from '@/components/project/OverviewPane'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { DocsPane } from '@/components/docs/DocsPane'
import { BoardsPane } from '@/components/boards/BoardsPane'
import { TeamPane } from '@/components/team/TeamPane'
import { GitPane } from '@/components/git/GitPane'
import { IconArchive, IconCanvas, IconDoc, IconGit, IconHome, IconKanban, IconTrash, IconUsers } from '@/components/ui/Icon'
import { Confirm } from '@/components/ui/Modal'
import { Dropdown, DropdownDivider, DropdownItem } from '@/components/ui/Dropdown'

type Tab = 'overview' | 'tasks' | 'docs' | 'boards' | 'team' | 'git'

const TABS: Array<{ id: Tab; label: string; icon: JSX.Element }> = [
  { id: 'overview', label: 'Overview', icon: <IconHome size={14} /> },
  { id: 'tasks', label: 'Tasks', icon: <IconKanban size={14} /> },
  { id: 'docs', label: 'Docs', icon: <IconDoc size={14} /> },
  { id: 'boards', label: 'Boards', icon: <IconCanvas size={14} /> },
  { id: 'team', label: 'Team', icon: <IconUsers size={14} /> },
  { id: 'git', label: 'Git', icon: <IconGit size={14} /> },
]

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const project = useProjects((s) => (id ? s.getProject(id) : undefined))
  const archiveProject = useProjects((s) => s.archiveProject)
  const deleteProject = useProjects((s) => s.deleteProject)
  const user = useAuth((s) => s.currentUser())
  const team = useTeams((s) => (project?.teamId ? s.getTeam(project.teamId) : undefined))
  const members = useTeams((s) => (team ? s.membersByTeam(team.id) : []))

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const navigate = useNavigate()
  const memberIds = useMemo(() => {
    if (!user) return []
    const ids = new Set<string>([user.id])
    for (const m of members) ids.add(m.userId)
    return Array.from(ids)
  }, [members, user])

  if (!user) return <Navigate to="/login" replace />
  if (!project) return <Navigate to="/" replace />

  return (
    <Layout>
      <Topbar
        breadcrumbs={
          <>
            <Crumb onClick={() => navigate('/')}>Projects</Crumb>
            <CrumbSep />
            <Crumb>
              <span className="mr-1">{project.icon}</span>
              {project.title}
            </Crumb>
          </>
        }
        actions={
          <Dropdown
            align="right"
            trigger={<button className="btn btn-ghost text-sm">⋯</button>}
          >
            {(close) => (
              <>
                <DropdownItem
                  icon={<IconArchive />}
                  onClick={() => {
                    close()
                    setConfirmArchive(true)
                  }}
                >
                  {project.status === 'archived' ? 'Восстановить' : 'В архив'}
                </DropdownItem>
                <DropdownDivider />
                <DropdownItem
                  icon={<IconTrash />}
                  danger
                  onClick={() => {
                    close()
                    setConfirmDelete(true)
                  }}
                >
                  Удалить проект
                </DropdownItem>
              </>
            )}
          </Dropdown>
        }
      />

      {/* Tab bar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-line bg-paper px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === t.id
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-light hover:text-ink'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && <div className="h-full overflow-y-auto"><OverviewPane projectId={project.id} /></div>}
        {activeTab === 'tasks' && <KanbanBoard projectId={project.id} memberIds={memberIds} />}
        {activeTab === 'docs' && <DocsPane scope={{ projectId: project.id }} />}
        {activeTab === 'boards' && <BoardsPane scope={{ projectId: project.id }} />}
        {activeTab === 'team' && <div className="h-full overflow-y-auto"><TeamPane projectId={project.id} /></div>}
        {activeTab === 'git' && <div className="h-full overflow-y-auto"><GitPane projectId={project.id} /></div>}
      </div>

      <Confirm
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={() => {
          if (project.status === 'archived') {
            useProjects.getState().restoreProject(project.id)
          } else {
            archiveProject(project.id)
            navigate('/')
          }
        }}
        title={project.status === 'archived' ? 'Восстановить проект?' : 'Архивировать проект?'}
        message={
          project.status === 'archived'
            ? 'Проект снова появится в основном списке.'
            : 'Проект будет скрыт из основного списка, но данные сохранятся.'
        }
      />

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteProject(project.id)
          navigate('/')
        }}
        title="Удалить проект навсегда?"
        message="Все задачи, документы, канвасы и связи этого проекта будут удалены. Это действие нельзя отменить."
        destructive
        confirmText="Удалить"
      />
    </Layout>
  )
}
