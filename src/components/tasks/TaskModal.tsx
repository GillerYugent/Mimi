import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import type { ID, Task, TaskPriority, TaskStatus } from '@/types'
import { useTasks } from '@/store/taskStore'
import { useAuth } from '@/store/authStore'
import { formatDateInput } from '@/utils/date'
import { IconCheck, IconPlus, IconTrash } from '@/components/ui/Icon'

// Colored dots for status
const StatusDot = ({ color }: { color: string }) => (
  <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
)
const PriorityDot = ({ color }: { color: string }) => (
  <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
)

const STATUS_OPTIONS = [
  { value: 'backlog'     as TaskStatus, label: 'Backlog',      icon: <StatusDot color="bg-ink-lighter" /> },
  { value: 'todo'        as TaskStatus, label: 'To Do',         icon: <StatusDot color="bg-blue-400" /> },
  { value: 'in_progress' as TaskStatus, label: 'In Progress',   icon: <StatusDot color="bg-amber-400" /> },
  { value: 'review'      as TaskStatus, label: 'Review',        icon: <StatusDot color="bg-violet-400" /> },
  { value: 'done'        as TaskStatus, label: 'Done',          icon: <StatusDot color="bg-emerald-400" /> },
]

const PRIORITY_OPTIONS = [
  { value: 'low'    as TaskPriority, label: 'Низкий',   icon: <PriorityDot color="bg-sky-400" /> },
  { value: 'medium' as TaskPriority, label: 'Средний',  icon: <PriorityDot color="bg-amber-400" /> },
  { value: 'high'   as TaskPriority, label: 'Высокий',  icon: <PriorityDot color="bg-orange-400" /> },
  { value: 'urgent' as TaskPriority, label: 'Срочный',  icon: <PriorityDot color="bg-red-500" /> },
]

interface Props {
  task: Task
  onClose: () => void
  memberIds?: ID[]
}

export function TaskModal({ task, onClose, memberIds }: Props) {
  const updateTask = useTasks((s) => s.updateTask)
  const deleteTask = useTasks((s) => s.deleteTask)
  const createTask = useTasks((s) => s.createTask)
  const subs = useTasks((s) => s.subtasks(task.id))
  const getUser = useAuth((s) => s.getUser)

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [deadline, setDeadline] = useState(formatDateInput(task.deadline))
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || '')
  const [labelInput, setLabelInput] = useState('')
  const [labels, setLabels] = useState<string[]>(task.labels)
  const [subTitle, setSubTitle] = useState('')
  const [commitSha, setCommitSha] = useState(task.commitSha || '')
  const [pullRequestUrl, setPullRequestUrl] = useState(task.pullRequestUrl || '')

  const save = async () => {
    await updateTask(task.id, {
      title: title.trim() || task.title,
      description,
      status,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      assigneeId: assigneeId || undefined,
      labels,
      commitSha: commitSha || undefined,
      pullRequestUrl: pullRequestUrl || undefined,
    })
    onClose()
  }

  const addLabel = () => {
    const l = labelInput.trim()
    if (!l) return
    if (!labels.includes(l)) setLabels([...labels, l])
    setLabelInput('')
  }
  const removeLabel = (l: string) => setLabels(labels.filter((x) => x !== l))

  const addSubtask = async () => {
    if (!subTitle.trim()) return
    await createTask({ projectId: task.projectId, parentTaskId: task.id, title: subTitle })
    setSubTitle('')
  }

  const memberOptions = (memberIds || []).map((id) => {
    const u = getUser(id)
    return { value: id, label: u?.name || id }
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Задача</span>
          <span className="chip">{task.id.slice(-6)}</span>
        </div>
      }
      width="lg"
      footer={
        <>
          <button
            className="btn btn-danger mr-auto text-sm"
            onClick={async () => {
              if (confirm('Удалить задачу и все подзадачи?')) {
                await deleteTask(task.id)
                onClose()
              }
            }}
          >
            <IconTrash size={14} /> Удалить
          </button>
          <button className="btn btn-ghost text-sm" onClick={onClose}>
            Отмена
          </button>
          <Button variant="primary" onClick={save}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <Textarea
          label="Описание"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Что нужно сделать, детали, критерии готовности..."
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Статус"
            value={status}
            onChange={(v) => setStatus(v as TaskStatus)}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Приоритет"
            value={priority}
            onChange={(v) => setPriority(v as TaskPriority)}
            options={PRIORITY_OPTIONS}
          />

          <DatePicker
            label="Дедлайн"
            value={deadline}
            onChange={setDeadline}
          />

          <Select
            label="Исполнитель"
            value={assigneeId}
            onChange={setAssigneeId}
            options={memberOptions}
            nullable
            nullLabel="— не назначен —"
            placeholder="— не назначен —"
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-ink-light">Метки</div>
          <div className="mb-2 flex flex-wrap gap-1">
            {labels.map((l) => (
              <span key={l} className="chip gap-1">
                {l}
                <button className="text-ink-lighter hover:text-ink" onClick={() => removeLabel(l)}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-xs"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addLabel()
                }
              }}
              placeholder="bug, backend, v1..."
            />
            <button className="btn btn-outline text-xs" onClick={addLabel}>
              <IconPlus size={12} /> добавить
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Привязка к коммиту (SHA)"
            value={commitSha}
            onChange={(e) => setCommitSha(e.target.value)}
            placeholder="a3f5c21"
          />
          <Input
            label="Pull Request URL"
            value={pullRequestUrl}
            onChange={(e) => setPullRequestUrl(e.target.value)}
            placeholder="https://github.com/.../pull/42"
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-ink-light">Подзадачи</div>
          <div className="space-y-1">
            {subs.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded border border-line px-2 py-1.5 text-sm">
                <button
                  onClick={() => updateTask(s.id, { status: s.status === 'done' ? 'todo' : 'done' })}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    s.status === 'done' ? 'border-ink bg-ink text-paper' : 'border-line'
                  }`}
                >
                  {s.status === 'done' && <IconCheck size={10} />}
                </button>
                <span className={`flex-1 ${s.status === 'done' ? 'text-ink-lighter line-through' : 'text-ink'}`}>
                  {s.title}
                </span>
                <button
                  className="text-ink-lighter hover:text-red-600"
                  onClick={() => deleteTask(s.id)}
                  aria-label="Удалить подзадачу"
                >
                  <IconTrash size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className="input flex-1 text-xs"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSubtask()
                }
              }}
              placeholder="Новая подзадача..."
            />
            <button className="btn btn-outline text-xs" onClick={addSubtask}>
              <IconPlus size={12} /> добавить
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
