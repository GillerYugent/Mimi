import { MouseEvent, useRef, useState, useEffect } from 'react'
import type { Canvas, CanvasElement, CanvasElementType, ID } from '@/types'
import { useBoards } from '@/store/boardStore'
import { IconPlus, IconTrash } from '@/components/ui/Icon'

interface Props {
  canvas: Canvas
}

type DragState =
  | { kind: 'none' }
  | { kind: 'pan'; startX: number; startY: number; originX: number; originY: number }
  | { kind: 'move'; id: ID; startX: number; startY: number; origX: number; origY: number }
  | { kind: 'arrow'; fromId: ID; toX: number; toY: number }

const TOOLS: Array<{ id: CanvasElementType; label: string; hint: string }> = [
  { id: 'block', label: '□ Блок', hint: 'Прямоугольный блок' },
  { id: 'sticker', label: '◆ Стикер', hint: 'Заметка-стикер' },
  { id: 'text', label: 'T Текст', hint: 'Текстовая метка' },
  { id: 'mind_node', label: '○ Узел', hint: 'Узел mind map' },
  { id: 'arrow', label: '↗ Стрелка', hint: 'Соединить два элемента' },
]

export function CanvasView({ canvas }: Props) {
  const addElement = useBoards((s) => s.addElement)
  const updateElement = useBoards((s) => s.updateElement)
  const deleteElement = useBoards((s) => s.deleteElement)
  const renameCanvas = useBoards((s) => s.renameCanvas)

  const svgRef = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<CanvasElementType | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragState, setDragState] = useState<DragState>({ kind: 'none' })
  const [selected, setSelected] = useState<ID | null>(null)
  const [arrowFromId, setArrowFromId] = useState<ID | null>(null)
  const [editingElementId, setEditingElementId] = useState<ID | null>(null)

  const handleCanvasClick = (e: MouseEvent) => {
    if (!tool || tool === 'arrow') return
    if ((e.target as SVGElement).dataset.elementId) return

    const rect = svgRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left - pan.x
    const y = e.clientY - rect.top - pan.y

    const defaults: Record<Exclude<CanvasElementType, 'arrow'>, { width: number; height: number; text: string }> = {
      block: { width: 140, height: 60, text: 'Блок' },
      sticker: { width: 120, height: 100, text: 'Заметка' },
      text: { width: 120, height: 28, text: 'Текст' },
      mind_node: { width: 110, height: 50, text: 'Идея' },
    }
    const d = defaults[tool as Exclude<CanvasElementType, 'arrow'>]
    addElement(canvas.id, {
      type: tool,
      x: x - d.width / 2,
      y: y - d.height / 2,
      width: d.width,
      height: d.height,
      text: d.text,
    })
    setTool(null)
  }

  const onMouseMove = (e: MouseEvent) => {
    if (dragState.kind === 'pan') {
      setPan({
        x: dragState.originX + (e.clientX - dragState.startX),
        y: dragState.originY + (e.clientY - dragState.startY),
      })
    } else if (dragState.kind === 'move') {
      updateElement(canvas.id, dragState.id, {
        x: dragState.origX + (e.clientX - dragState.startX),
        y: dragState.origY + (e.clientY - dragState.startY),
      })
    } else if (dragState.kind === 'arrow') {
      const rect = svgRef.current!.getBoundingClientRect()
      setDragState({
        ...dragState,
        toX: e.clientX - rect.left - pan.x,
        toY: e.clientY - rect.top - pan.y,
      })
    }
  }

  const stopDrag = () => setDragState({ kind: 'none' })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selected) deleteElement(canvas.id, selected)
      if (e.key === 'Escape') {
        setTool(null)
        setArrowFromId(null)
        setEditingElementId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, canvas.id, deleteElement])

  const elementsMap = new Map(canvas.elements.map((e) => [e.id, e]))

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2">
        <input
          className="max-w-xs border-none bg-transparent text-sm font-semibold text-ink outline-none"
          value={canvas.title}
          onChange={(e) => renameCanvas(canvas.id, e.target.value)}
        />
        <div className="ml-4 h-5 w-px bg-line" />
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={t.hint}
            onClick={() => {
              setTool(tool === t.id ? null : t.id)
              setArrowFromId(null)
            }}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              tool === t.id ? 'bg-ink text-paper' : 'text-ink-light hover:bg-paper-hover hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto text-xs text-ink-lighter">
          {canvas.elements.length} элементов · Delete — удалить выбранный
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          className={`canvas-grid absolute inset-0 h-full w-full ${
            tool ? 'cursor-crosshair' : dragState.kind === 'pan' ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onMouseDown={(e) => {
            if (e.target === svgRef.current) {
              // Pan start
              setDragState({
                kind: 'pan',
                startX: e.clientX,
                startY: e.clientY,
                originX: pan.x,
                originY: pan.y,
              })
              setSelected(null)
            }
          }}
          onMouseMove={onMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onClick={handleCanvasClick}
        >
          <g transform={`translate(${pan.x},${pan.y})`}>
            {/* Arrows */}
            {canvas.elements.filter((e) => e.type === 'arrow').map((arrow) => {
              const from = arrow.fromId ? elementsMap.get(arrow.fromId) : undefined
              const to = arrow.toId ? elementsMap.get(arrow.toId) : undefined
              if (!from || !to) return null
              const x1 = from.x + from.width / 2
              const y1 = from.y + from.height / 2
              const x2 = to.x + to.width / 2
              const y2 = to.y + to.height / 2
              return (
                <g
                  key={arrow.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(arrow.id)
                  }}
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={selected === arrow.id ? '#37352f' : '#9b9a97'}
                    strokeWidth={selected === arrow.id ? 2 : 1.5}
                    markerEnd="url(#arrowhead)"
                  />
                </g>
              )
            })}

            {/* Arrow preview */}
            {dragState.kind === 'arrow' &&
              (() => {
                const from = elementsMap.get(dragState.fromId)
                if (!from) return null
                const x1 = from.x + from.width / 2
                const y1 = from.y + from.height / 2
                return (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={dragState.toX}
                    y2={dragState.toY}
                    stroke="#787774"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                )
              })()}

            {/* Non-arrow elements */}
            {canvas.elements
              .filter((e) => e.type !== 'arrow')
              .map((el) => (
                <ElementNode
                  key={el.id}
                  element={el}
                  selected={selected === el.id}
                  editing={editingElementId === el.id}
                  onSelect={(e) => {
                    e.stopPropagation()
                    if (tool === 'arrow') {
                      if (!arrowFromId) {
                        setArrowFromId(el.id)
                        setDragState({ kind: 'arrow', fromId: el.id, toX: el.x, toY: el.y })
                      } else if (arrowFromId !== el.id) {
                        addElement(canvas.id, {
                          type: 'arrow',
                          x: 0,
                          y: 0,
                          width: 0,
                          height: 0,
                          text: '',
                          fromId: arrowFromId,
                          toId: el.id,
                        })
                        setArrowFromId(null)
                        setDragState({ kind: 'none' })
                        setTool(null)
                      }
                    } else {
                      setSelected(el.id)
                    }
                  }}
                  onStartMove={(e) => {
                    if (tool === 'arrow') return
                    e.stopPropagation()
                    setSelected(el.id)
                    setDragState({
                      kind: 'move',
                      id: el.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: el.x,
                      origY: el.y,
                    })
                  }}
                  onDoubleClick={() => setEditingElementId(el.id)}
                  onBlurText={(text) => {
                    updateElement(canvas.id, el.id, { text })
                    setEditingElementId(null)
                  }}
                />
              ))}

            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,8 L8,4 z" fill="#787774" />
              </marker>
            </defs>
          </g>
        </svg>

        {canvas.elements.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="max-w-xs text-center">
              <h3 className="title-serif text-xl font-semibold text-ink">Пустой канвас</h3>
              <p className="mt-1 text-sm text-ink-light">
                Выберите инструмент вверху и кликните по холсту, чтобы добавить элемент.
              </p>
            </div>
          </div>
        )}

        {selected && (
          <div className="absolute right-4 top-4 flex items-center gap-1 rounded-md border border-line bg-paper p-1 shadow-notion">
            <button
              className="rounded p-1 text-ink-light hover:bg-paper-hover hover:text-red-600"
              onClick={() => {
                deleteElement(canvas.id, selected)
                setSelected(null)
              }}
              aria-label="Удалить"
            >
              <IconTrash size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface NodeProps {
  element: CanvasElement
  selected: boolean
  editing: boolean
  onSelect: (e: MouseEvent) => void
  onStartMove: (e: MouseEvent) => void
  onDoubleClick: () => void
  onBlurText: (text: string) => void
}

function ElementNode({ element, selected, editing, onSelect, onStartMove, onDoubleClick, onBlurText }: NodeProps) {
  const isRound = element.type === 'mind_node' || element.type === 'sticker'
  const fill = element.type === 'sticker' ? '#fbfbfa' : element.type === 'text' ? 'transparent' : '#ffffff'
  const stroke = selected ? '#37352f' : '#d6d5d0'
  const strokeWidth = selected ? 2 : 1

  return (
    <g
      data-element-id={element.id}
      onMouseDown={onStartMove}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      style={{ cursor: 'move' }}
    >
      {element.type !== 'text' && (
        isRound ? (
          element.type === 'mind_node' ? (
            <ellipse
              cx={element.x + element.width / 2}
              cy={element.y + element.height / 2}
              rx={element.width / 2}
              ry={element.height / 2}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          ) : (
            <rect
              x={element.x}
              y={element.y}
              width={element.width}
              height={element.height}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              rx={8}
            />
          )
        ) : (
          <rect
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            rx={4}
          />
        )
      )}
      <foreignObject x={element.x} y={element.y} width={element.width} height={element.height}>
        {editing ? (
          <textarea
            autoFocus
            defaultValue={element.text}
            onBlur={(e) => onBlurText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ;(e.target as HTMLTextAreaElement).blur()
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              resize: 'none',
              outline: 'none',
              padding: 6,
              fontSize: 13,
              textAlign: 'center',
              color: '#37352f',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center px-2 text-center text-[13px] ${
              element.type === 'text' ? 'font-semibold' : ''
            }`}
            style={{ color: '#37352f', pointerEvents: 'none' }}
          >
            {element.text || <span className="text-ink-lighter">Текст</span>}
          </div>
        )}
      </foreignObject>
    </g>
  )
}

// Unused-export guard (keeps tree-shaking predictable)
export const _keepIcon = IconPlus
