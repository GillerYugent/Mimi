import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/authStore'
import { useProjects } from '@/store/projectStore'
import {
  IconArchive,
  IconBell,
  IconFolder,
  IconHome,
  IconLogout,
  IconPlus,
  IconSettings,
  IconUser,
} from '@/components/ui/Icon'
import { Dropdown, DropdownDivider, DropdownItem } from '@/components/ui/Dropdown'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { useNotifications } from '@/store/notificationStore'

export function Sidebar() {
  const user = useAuth((s) => s.currentUser())
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()
  const loc = useLocation()

  const active = useProjects((s) => (user ? s.listActive(user.id) : []))
  const archived = useProjects((s) => (user ? s.listArchived(user.id) : []))
  const createProject = useProjects((s) => s.createProject)
  const unread = useNotifications((s) => (user ? s.unreadCount(user.id) : 0))

  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📁')

  if (!user) return null

  const onCreate = () => {
    const t = title.trim()
    if (!t) return
    const p = createProject({ ownerId: user.id, title: t, description, icon })
    setShowNew(false)
    setTitle('')
    setDescription('')
    setIcon('📁')
    navigate(`/project/${p.id}`)
  }

  const isActive = (path: string) => loc.pathname === path
  const isInProject = (id: string) => loc.pathname.startsWith(`/project/${id}`)

  return (
    <>
      <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-line bg-paper-sidebar">
        {/* Workspace switcher */}
        <Dropdown
          align="left"
          width="w-56"
          trigger={
            <button className="mx-2 mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-paper-hover">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-ink text-xs font-semibold text-paper">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{user.name}</div>
                <div className="truncate text-xs text-ink-light">{user.email}</div>
              </div>
            </button>
          }
        >
          {(close) => (
            <>
              <DropdownItem icon={<IconUser />} onClick={() => { close(); navigate('/settings') }}>
                Настройки профиля
              </DropdownItem>
              <DropdownItem icon={<IconSettings />} onClick={() => { close(); navigate('/settings') }}>
                Настройки аккаунта
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem icon={<IconLogout />} onClick={() => { close(); logout(); navigate('/login') }}>
                Выйти
              </DropdownItem>
            </>
          )}
        </Dropdown>

        <div className="mt-3 space-y-0.5 px-2">
          <Link to="/" className={`sidebar-item ${isActive('/') ? 'active' : ''}`}>
            <IconHome /> Dashboard
          </Link>
          <Link to="/my-space" className={`sidebar-item ${isActive('/my-space') ? 'active' : ''}`}>
            <IconUser /> My Space
          </Link>
          <Link to="/notifications" className={`sidebar-item ${isActive('/notifications') ? 'active' : ''}`}>
            <IconBell />
            <span className="flex-1">Уведомления</span>
            {unread > 0 && (
              <span className="rounded-full bg-ink px-1.5 text-[10px] font-medium text-paper">{unread}</span>
            )}
          </Link>
          <Link to="/settings" className={`sidebar-item ${isActive('/settings') ? 'active' : ''}`}>
            <IconSettings /> Настройки
          </Link>
        </div>

        <div className="mt-5 px-2">
          <div className="flex items-center justify-between px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-lighter">
            <span>Проекты</span>
            <button
              className="rounded p-0.5 hover:bg-paper-hover"
              onClick={() => setShowNew(true)}
              aria-label="Новый проект"
            >
              <IconPlus size={14} />
            </button>
          </div>

          <div className="space-y-0.5">
            {active.length === 0 && (
              <div className="px-2 py-1 text-xs text-ink-lighter">Нет активных проектов</div>
            )}
            {active.map((p) => (
              <Link
                key={p.id}
                to={`/project/${p.id}`}
                className={`sidebar-item ${isInProject(p.id) ? 'active' : ''}`}
                title={p.title}
              >
                <span className="shrink-0">{p.icon || <IconFolder />}</span>
                <span className="truncate">{p.title}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-auto px-2 pb-3">
          {archived.length > 0 && (
            <Link to="/archive" className={`sidebar-item ${isActive('/archive') ? 'active' : ''}`}>
              <IconArchive />
              <span className="flex-1">Архив</span>
              <span className="text-xs text-ink-lighter">{archived.length}</span>
            </Link>
          )}
        </div>
      </aside>

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="Создать проект"
        footer={
          <>
            <button className="btn btn-ghost text-sm" onClick={() => setShowNew(false)}>
              Отмена
            </button>
            <button className="btn btn-primary text-sm" onClick={onCreate} disabled={!title.trim()}>
              Создать
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-3">
            <label className="block w-24">
              <span className="mb-1 block text-xs font-medium text-ink-light">Иконка</span>
              <input
                className="input text-center text-2xl"
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 2))}
                maxLength={2}
              />
            </label>
            <Input
              label="Название"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mimi Backend"
              autoFocus
              className="flex-1"
            />
          </div>
          <Textarea
            label="Описание"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание проекта"
          />
        </div>
      </Modal>
    </>
  )
}
