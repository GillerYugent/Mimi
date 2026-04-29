import { useEffect, useState } from 'react'
import type { ID, Task } from '@/types'
import { useTasks } from '@/store/taskStore'
import { useProjects } from '@/store/projectStore'
import { useAuth } from '@/store/authStore'
import { Input, Textarea } from '@/components/ui/Input'
import { IconCheck, IconPlus, IconTrash } from '@/components/ui/Icon'
import { formatFullDate, formatDateInput } from '@/utils/date'

const MY_SPACE_TITLE = 'My Space'
const MY_SPACE_ICON = '⭐'

// На бэке у нас единый формат — задачи привязаны к project_id. Поэтому
// для личного пространства мы лениво создаём (или находим) проект с
// особым названием/иконкой и используем его id для задач.
async function ensureMySpaceProject(): Promise<string> {
  const projects = useProjects.getState()
  const found = Object.values(projects.projects).find(
    (p) => p.title === MY_SPACE_TITLE && p.icon === MY_SPACE_ICON
  )
  if (found) return found.id
  const created = await projects.createProject({
    title: MY_SPACE_TITLE,
    description: 'Личные задачи',
    icon: MY_SPACE_ICON,
  })
  return created.id
}

interface Props {
  userId: ID
  /** ID my_space.id — здесь не используется напрямую, но передаётся ради
   * консистентности и того, что в будущем здесь могут появиться запросы,
   * специфичные для my_space-scope. */
  mySpaceId: ID
}

export function MySpaceTasks({ userId }: Props) {
  const [projectId, setProjectId] = useState<string | null>(null)
  const tasks = useTasks((s) => (projectId ? s.byProject(projectId) : []))
  const loadByProject = useTasks((s) => s.loadByProject)
  const createTask = useTasks((s) => s.createTask)
  const updateTask = useTasks((s) => s.updateTask)
  const deleteTask = useTasks((s) => s.deleteTask)
  const user = useAuth((s) => s.user)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')

  useEffect(() => {
    void (async () => {
      const id = await ensureMySpaceProject()
      setProjectId(id)
      void loadByProject(id)
    })()
  }, [userId])

  const add = async () => {
    if (!title.trim() || !user || !projectId) return
    await createTask({
      projectId,
      title,
      description,
      status: 'todo',
      assigneeId: user.id,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
    })
    setTitle('')
    setDescription('')
    setDeadline('')
  }

  if (!projectId) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-10 text-sm text-ink-light">Подготовка…</div>
    )
  }

  const active = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      <h2 className="title-serif mb-1 text-2xl font-bold tracking-tight text-ink">Личные задачи</h2>
      <p className="mb-6 text-sm text-ink-light">
        Задачи, идеи и напоминания, не привязанные к рабочим проектам
      </p>

      <div className="mb-6 rounded-md border border-line bg-paper p-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Новая задача" />
        <Textarea
          rows={2}
          className="mt-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Детали (опционально)"
        />
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            className="input w-auto text-xs"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <button
            className="btn btn-primary ml-auto text-sm"
            onClick={add}
            disabled={!title.trim()}
          >
            <IconPlus size={14} /> Добавить
          </button>
        </div>
      </div>

      <section className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-light">
          Активные · {active.length}
        </h3>
        <div className="space-y-1">
          {active.length === 0 && (
            <div className="py-3 text-sm text-ink-light">Нет активных задач</div>
          )}
          {active.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={() => updateTask(t.id, { status: 'done' })}
              onDelete={() => deleteTask(t.id)}
              onUpdateDeadline={(iso) => updateTask(t.id, { deadline: iso })}
            />
          ))}
        </div>
      </section>

      {done.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-light">
            Готово · {done.length}
          </h3>
          <div className="space-y-1">
            {done.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={() => updateTask(t.id, { status: 'todo' })}
                onDelete={() => deleteTask(t.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  onUpdateDeadline,
}: {
  task: Task
  onToggle: () => void
  onDelete: () => void
  onUpdateDeadline?: (iso: string | undefined) => void
}) {
  const done = task.status === 'done'
  const overdue = !done && task.deadline && new Date(task.deadline).getTime() < Date.now()

  return (
    <div className="group flex items-start gap-2 rounded-md border border-line bg-paper px-3 py-2">
      <button
        onClick={onToggle}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          done ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink'
        }`}
      >
        {done && <IconCheck size={10} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${done ? 'text-ink-lighter line-through' : 'text-ink'}`}>
          {task.title}
        </div>
        {task.description && <div className="mt-0.5 text-xs text-ink-light">{task.description}</div>}
        {task.deadline && (
          <div className={`mt-0.5 text-[11px] ${overdue ? 'text-red-600' : 'text-ink-lighter'}`}>
            до {formatFullDate(task.deadline)}
          </div>
        )}
      </div>
      {onUpdateDeadline && (
        <input
          type="date"
          className="input w-auto py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100"
          value={formatDateInput(task.deadline)}
          onChange={(e) =>
            onUpdateDeadline(e.target.value ? new Date(e.target.value).toISOString() : undefined)
          }
        />
      )}
      <button
        className="rounded p-1 text-ink-lighter opacity-0 hover:bg-paper-hover hover:text-red-600 group-hover:opacity-100"
        onClick={onDelete}
        aria-label="Удалить"
      >
        <IconTrash size={12} />
      </button>
    </div>
  )
}
