import { useState } from 'react'
import type { ID } from '@/types'
import { useBoards } from '@/store/boardStore'
import { IconCanvas, IconPlus, IconTrash } from '@/components/ui/Icon'
import { CanvasView } from './CanvasView'
import { formatRelative } from '@/utils/date'
import { Confirm } from '@/components/ui/Modal'

interface Props {
  scope: { projectId?: ID; mySpaceOwnerId?: ID }
}

export function BoardsPane({ scope }: Props) {
  const list = useBoards((s) => s.list(scope))
  const createCanvas = useBoards((s) => s.createCanvas)
  const deleteCanvas = useBoards((s) => s.deleteCanvas)
  const getCanvas = useBoards((s) => s.getCanvas)

  const [selectedId, setSelectedId] = useState<ID | null>(list[0]?.id ?? null)
  const [pendingDelete, setPendingDelete] = useState<ID | null>(null)

  const current = selectedId ? getCanvas(selectedId) : undefined

  const onCreate = () => {
    const c = createCanvas({ title: `Канвас ${list.length + 1}`, ...scope })
    setSelectedId(c.id)
  }

  return (
    <div className="flex h-full">
      <div className="flex w-56 shrink-0 flex-col border-r border-line bg-paper-soft">
        <div className="flex items-center justify-between border-b border-line p-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-light">Канвасы</span>
          <button className="rounded p-0.5 text-ink-light hover:bg-paper-hover" onClick={onCreate} aria-label="Новый канвас">
            <IconPlus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {list.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-ink-lighter">Канвасов ещё нет</div>
          )}
          {list.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-md px-1.5 py-1 ${
                selectedId === c.id ? 'bg-paper-active' : 'hover:bg-paper-hover'
              }`}
            >
              <button
                onClick={() => setSelectedId(c.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm text-ink"
              >
                <IconCanvas size={14} className="shrink-0 text-ink-light" />
                <span className="truncate">{c.title}</span>
              </button>
              <span className="hidden shrink-0 text-[10px] text-ink-lighter group-hover:inline-block">
                {formatRelative(c.updatedAt)}
              </span>
              <button
                onClick={() => setPendingDelete(c.id)}
                className="rounded p-0.5 text-ink-lighter opacity-0 hover:bg-paper-hover hover:text-red-600 group-hover:opacity-100"
                aria-label="Удалить канвас"
              >
                <IconTrash size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1">
        {current ? (
          <CanvasView canvas={current} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-xs text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-paper-soft text-ink-light">
                <IconCanvas size={20} />
              </div>
              <h3 className="text-base font-semibold text-ink">Создайте канвас</h3>
              <p className="mt-1 text-sm text-ink-light">
                Визуализируйте архитектуру, stroymap или проведите brainstorm.
              </p>
              <button className="btn btn-primary mt-4 text-sm" onClick={onCreate}>
                <IconPlus size={14} /> Новый канвас
              </button>
            </div>
          </div>
        )}
      </div>

      <Confirm
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteCanvas(pendingDelete)
            if (selectedId === pendingDelete) setSelectedId(null)
          }
        }}
        title="Удалить канвас?"
        message="Все элементы канваса будут удалены безвозвратно."
        destructive
        confirmText="Удалить"
      />
    </div>
  )
}
