import { DragEvent, useMemo, useState } from 'react'
import type { ID, Task, TaskStatus } from '@/types'
import { useTasks } from '@/store/taskStore'
import { useAuth } from '@/store/authStore'
import { IconPlus, IconSearch } from '@/components/ui/Icon'
import { TaskModal } from './TaskModal'
import { Input } from '@/components/ui/Input'

const COLUMNS: Array<{ id: TaskStatus; title: string }> = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
]

export function KanbanBoard({ projectId, memberIds }: { projectId: ID; memberIds?: ID[] }) {
  const allTasks = useTasks((s) => s.byProject(projectId))
  const moveTask = useTasks((s) => s.moveTask)
  const createTask = useTasks((s) => s.createTask)
  const getUser = useAuth((s) => s.getUser)

  const [search, setSearch] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState<ID | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<'' | 'low' | 'medium' | 'high' | 'urgent'>('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [creating, setCreating] = useState<TaskStatus | null>(null)
  const [dragged, setDragged] = useState<ID | null>(null)
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allTasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false
      if (assigneeFilter && t.assigneeId !== assigneeFilter) return false
      if (priorityFilter && t.priority !== priorityFilter) return false
      return true
    })
  }, [allTasks, search, assigneeFilter, priorityFilter])

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      backlog: [], todo: [], in_progress: [], review: [], done: [],
    }
    for (const t of filtered) map[t.status].push(t)
    return map
  }, [filtered])

  const onDrop = (status: TaskStatus) => {
    if (dragged) moveTask(dragged, status, Date.now())
    setDragged(null)
    setDragOver(null)
  }

  const onQuickCreate = (status: TaskStatus, title: string) => {
    if (!title.trim()) return
    createTask({ projectId, title, status })
    setCreating(null)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-6 py-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <IconSearch
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-lighter"
          />
          <input
            className="input pl-8 py-1.5 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск задач..."
          />
        </div>

        {memberIds && memberIds.length > 0 && (
          <select
            className="input w-auto py-1.5 text-xs"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="">Все исполнители</option>
            {memberIds.map((id) => {
              const u = getUser(id)
              return (
                <option key={id} value={id}>
                  {u?.name || id}
                </option>
              )
            })}
          </select>
        )}

        <select
          className="input w-auto py-1.5 text-xs"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
        >
          <option value="">Любой приоритет</option>
          <option value="urgent">Срочный</option>
          <option value="high">Высокий</option>
          <option value="medium">Средний</option>
          <option value="low">Низкий</option>
        </select>

        <div className="ml-auto text-xs text-ink-lighter">{filtered.length} задач</div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max gap-3 p-6">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(col.id)
              }}
              onDragLeave={() => setDragOver((prev) => (prev === col.id ? null : prev))}
              onDrop={() => onDrop(col.id)}
              className={`flex w-72 shrink-0 flex-col rounded-md border border-line bg-paper-soft transition-colors ${
                dragOver === col.id ? 'bg-paper-hover' : ''
              }`}
            >
              <div className="flex items-center justify-between px-3 pb-1 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-light">
                    {col.title}
                  </span>
                  <span className="rounded-sm bg-paper-hover px-1 text-[10px] text-ink-light">
                    {grouped[col.id].length}
                  </span>
                </div>
                <button
                  className="rounded p-0.5 text-ink-light hover:bg-paper-hover"
                  onClick={() => setCreating(col.id)}
                  aria-label="Добавить задачу"
                >
                  <IconPlus size={14} />
                </button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {grouped[col.id].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={() => setEditing(task)}
                    onDragStart={() => setDragged(task.id)}
                    onDragEnd={() => {
                      setDragged(null)
                      setDragOver(null)
                    }}
                  />
                ))}
                {creating === col.id && (
                  <QuickCreate onSubmit={(t) => onQuickCreate(col.id, t)} onCancel={() => setCreating(null)} />
                )}
                {grouped[col.id].length === 0 && creating !== col.id && (
                  <button
                    className="w-full rounded border border-dashed border-line py-6 text-xs text-ink-lighter hover:bg-paper-hover"
                    onClick={() => setCreating(col.id)}
                  >
                    + задача
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && <TaskModal task={editing} onClose={() => setEditing(null)} memberIds={memberIds} />}
    </div>
  )
}

interface CardProps {
  task: Task
  onOpen: () => void
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
  onDragEnd: (e: DragEvent<HTMLDivElement>) => void
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочно',
}

function TaskCard({ task, onOpen, onDragStart, onDragEnd }: CardProps) {
  const getUser = useAuth((s) => s.getUser)
  const subs = useTasks((s) => s.subtasks(task.id))
  const assignee = task.assigneeId ? getUser(task.assigneeId) : undefined
  const overdue =
    task.deadline && task.status !== 'done' && new Date(task.deadline).getTime() < Date.now()

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="group cursor-grab rounded-md border border-line bg-paper p-2.5 shadow-notion transition-all hover:border-line-strong active:cursor-grabbing"
    >
      {task.labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <span key={l} className="chip">
              {l}
            </span>
          ))}
        </div>
      )}
      <div className="text-sm text-ink">{task.title}</div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-light">
        {task.priority !== 'medium' && (
          <span className={`chip ${task.priority === 'urgent' ? 'text-red-600' : task.priority === 'high' ? 'text-ink' : ''}`}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        )}
        {task.deadline && (
          <span className={`chip ${overdue ? 'border-red-200 text-red-600' : ''}`}>
            {new Date(task.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
          </span>
        )}
        {subs.length > 0 && <span className="chip">{subs.filter((s) => s.status === 'done').length}/{subs.length} ✓</span>}
        {assignee && (
          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] font-medium text-paper">
            {assignee.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  )
}

function QuickCreate({ onSubmit, onCancel }: { onSubmit: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  return (
    <div className="rounded-md border border-line bg-paper p-2 shadow-notion">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(title)
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Название задачи"
      />
      <div className="mt-2 flex justify-end gap-1">
        <button className="btn btn-ghost text-xs" onClick={onCancel}>
          Отмена
        </button>
        <button
          className="btn btn-primary text-xs"
          onClick={() => onSubmit(title)}
          disabled={!title.trim()}
        >
          Добавить
        </button>
      </div>
    </div>
  )
}
