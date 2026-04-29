import type { CanvasElementType } from '@/types'

export interface ToolDef {
  id: ToolMode
  label: string
  hint: string
}

// Режимы курсора. select — обычный (выбор/перемещение), остальные
// при клике создают новый элемент (или связь — для arrow).
export type ToolMode = 'select' | CanvasElementType

export const TOOLS: ToolDef[] = [
  { id: 'select', label: '↖ Выбор', hint: 'V — выбирать и двигать элементы' },
  { id: 'block', label: '□ Блок', hint: 'B — прямоугольный блок' },
  { id: 'sticker', label: '◆ Стикер', hint: 'S — заметка-стикер' },
  { id: 'text', label: 'T Текст', hint: 'T — текстовая метка' },
  { id: 'mind_node', label: '○ Узел', hint: 'M — узел mind map' },
  { id: 'arrow', label: '↗ Стрелка', hint: 'A — соединить два элемента' },
]

interface Props {
  title: string
  onRename: (next: string) => void
  tool: ToolMode
  onTool: (t: ToolMode) => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  elementsCount: number
}

export function CanvasToolbar({
  title,
  onRename,
  tool,
  onTool,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  elementsCount,
}: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2">
      <input
        className="max-w-xs border-none bg-transparent text-sm font-semibold text-ink outline-none"
        value={title}
        onChange={(e) => onRename(e.target.value)}
      />

      <div className="ml-4 h-5 w-px bg-line" />

      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={t.hint}
          onClick={() => onTool(t.id)}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            tool === t.id
              ? 'bg-ink text-paper'
              : 'text-ink-light hover:bg-paper-hover hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-md border border-line bg-paper-soft px-1 py-0.5">
          <button
            onClick={onZoomOut}
            className="rounded px-1.5 text-ink-light hover:bg-paper-hover hover:text-ink"
            aria-label="Уменьшить"
          >
            −
          </button>
          <button
            onClick={onZoomReset}
            className="min-w-[3rem] rounded px-1 text-center text-xs text-ink-light hover:bg-paper-hover hover:text-ink"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            className="rounded px-1.5 text-ink-light hover:bg-paper-hover hover:text-ink"
            aria-label="Увеличить"
          >
            +
          </button>
        </div>
        <span className="text-xs text-ink-lighter">
          {elementsCount} · Del — удалить · Space+drag — пан · Ctrl+wheel — zoom
        </span>
      </div>
    </div>
  )
}
