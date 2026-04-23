import { Navigate } from 'react-router-dom'
import { useState } from 'react'
import { Layout } from '@/components/layout/Layout'
import { Topbar } from '@/components/layout/Topbar'
import { useAuth } from '@/store/authStore'
import { DocsPane } from '@/components/docs/DocsPane'
import { BoardsPane } from '@/components/boards/BoardsPane'
import { IconCanvas, IconDoc, IconKanban } from '@/components/ui/Icon'
import { MySpaceTasks } from '@/components/my-space/MySpaceTasks'

type Tab = 'notes' | 'tasks' | 'canvases'

const TABS: Array<{ id: Tab; label: string; icon: JSX.Element }> = [
  { id: 'notes', label: 'Заметки', icon: <IconDoc size={14} /> },
  { id: 'tasks', label: 'Задачи', icon: <IconKanban size={14} /> },
  { id: 'canvases', label: 'Канвасы', icon: <IconCanvas size={14} /> },
]

export function MySpacePage() {
  const user = useAuth((s) => s.currentUser())
  const [tab, setTab] = useState<Tab>('notes')

  if (!user) return <Navigate to="/login" replace />

  return (
    <Layout>
      <Topbar breadcrumbs={<span className="px-1.5 font-medium text-ink">My Space</span>} />
      <div className="flex shrink-0 items-center gap-1 border-b border-line bg-paper px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              tab === t.id ? 'border-ink text-ink' : 'border-transparent text-ink-light hover:text-ink'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === 'notes' && <DocsPane scope={{ mySpaceOwnerId: user.id }} />}
        {tab === 'tasks' && <MySpaceTasks userId={user.id} />}
        {tab === 'canvases' && <BoardsPane scope={{ mySpaceOwnerId: user.id }} />}
      </div>
    </Layout>
  )
}
