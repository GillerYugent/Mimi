import { MouseEvent, useEffect, useRef, useState } from 'react'
import type { Canvas, CanvasElement, CanvasElementType, ID } from '@/types'
import { useBoards } from '@/store/boardStore'
import { IconTrash } from '@/components/ui/Icon'
import { CanvasToolbar, type ToolMode } from './CanvasToolbar'
import { CanvasNode, type ResizeCorner } from './CanvasNode'
import { useCanvasViewport } from './useCanvasViewport'
import { anchorPoint } from './anchor'

interface Props {
  canvas: Canvas
}

// ─── Drag state machine ──────────────────────────────────────────
type DragState =
  | { kind: 'none' }
  | { kind: 'pan'; startScreenX: number; startScreenY: number; originPanX: number; originPanY: number }
  | { kind: 'move'; ids: ID[]; lastWorldX: number; lastWorldY: number }
  | { kind: 'resize'; id: ID; corner: ResizeCorner; orig: CanvasElement }
  | { kind: 'arrow'; fromId: ID; toX: number; toY: number }
  | { kind: 'marquee'; startWorldX: number; startWorldY: number; curWorldX: number; curWorldY: number }

const DEFAULTS: Record<Exclude<CanvasElementType, 'arrow'>, { width: number; height: number; text: string }> = {
  block:     { width: 160, height: 70,  text: 'Блок' },
  sticker:   { width: 140, height: 110, text: 'Заметка' },
  text:      { width: 140, height: 30,  text: 'Текст' },
  mind_node: { width: 130, height: 60,  text: 'Идея' },
}

export function CanvasView({ canvas }: Props) {
  const addElement = useBoards((s) => s.addElement)
  const updateElement = useBoards((s) => s.updateElement)
  const deleteElement = useBoards((s) => s.deleteElement)
  const renameCanvas = useBoards((s) => s.renameCanvas)

  const { ref, controls } = useCanvasViewport<SVGSVGElement>()
  const { viewport, setPan, setZoom, reset, toWorld } = controls

  const [tool, setTool] = useState<ToolMode>('select')
  const [drag, setDrag] = useState<DragState>({ kind: 'none' })
  const [selectedIds, setSelectedIds] = useState<Set<ID>>(new Set())
  const [hoveredId, setHoveredId] = useState<ID | null>(null)
  const [editingId, setEditingId] = useState<ID | null>(null)
  const [arrowFromId, setArrowFromId] = useState<ID | null>(null)
  const spacePressed = useRef(false)

  const elementsMap = new Map(canvas.elements.map((e) => [e.id, e]))

  // ─── Hotkeys ────────────────────────────────────────────────────
  useEffect(() => {
    const inEditableField = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || (t?.isContentEditable ?? false)
    }
    const onDown = (e: KeyboardEvent) => {
      if (inEditableField(e)) return
      if (e.code === 'Space') spacePressed.current = true
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          for (const id of selectedIds) deleteElement(canvas.id, id)
          setSelectedIds(new Set())
        }
      }
      if (e.key === 'Escape') {
        setTool('select')
        setArrowFromId(null)
        setEditingId(null)
        setSelectedIds(new Set())
      }
      const map: Record<string, ToolMode> = {
        v: 'select',
        b: 'block',
        s: 'sticker',
        t: 'text',
        m: 'mind_node',
        a: 'arrow',
      }
      const lk = e.key.toLowerCase()
      if (map[lk] && !e.metaKey && !e.ctrlKey && !e.altKey) setTool(map[lk])
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spacePressed.current = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [selectedIds, canvas.id, deleteElement])

  // ─── Helpers ────────────────────────────────────────────────────
  function selectOnly(id: ID | null) {
    setSelectedIds(id ? new Set([id]) : new Set())
  }
  function toggleInSelection(id: ID) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function createElementAt(t: Exclude<CanvasElementType, 'arrow'>, world: { x: number; y: number }) {
    const d = DEFAULTS[t]
    const created = addElement(canvas.id, {
      type: t,
      x: world.x - d.width / 2,
      y: world.y - d.height / 2,
      width: d.width,
      height: d.height,
      text: d.text,
    })
    setTool('select')
    selectOnly(created.id)
    setEditingId(created.id)
  }

  // ─── Mouse handlers ─────────────────────────────────────────────
  const onSvgMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    const isMiddle = e.button === 1
    const isLeft = e.button === 0
    const onBackground = e.target === ref.current

    if (spacePressed.current || isMiddle) {
      e.preventDefault()
      setDrag({
        kind: 'pan',
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        originPanX: viewport.pan.x,
        originPanY: viewport.pan.y,
      })
      return
    }

    if (!onBackground || !isLeft) return

    const world = toWorld(e.clientX, e.clientY)

    if (tool !== 'select' && tool !== 'arrow') {
      createElementAt(tool, world)
      return
    }

    if (tool === 'arrow') {
      setArrowFromId(null)
      setSelectedIds(new Set())
      return
    }

    setSelectedIds(new Set())
    setDrag({
      kind: 'marquee',
      startWorldX: world.x,
      startWorldY: world.y,
      curWorldX: world.x,
      curWorldY: world.y,
    })
  }

  const onSvgMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    switch (drag.kind) {
      case 'pan': {
        setPan({
          x: drag.originPanX + (e.clientX - drag.startScreenX),
          y: drag.originPanY + (e.clientY - drag.startScreenY),
        })
        break
      }
      case 'move': {
        const w = toWorld(e.clientX, e.clientY)
        const dx = w.x - drag.lastWorldX
        const dy = w.y - drag.lastWorldY
        for (const id of drag.ids) {
          const el = elementsMap.get(id)
          if (!el) continue
          updateElement(canvas.id, id, { x: el.x + dx, y: el.y + dy })
        }
        setDrag({ ...drag, lastWorldX: w.x, lastWorldY: w.y })
        break
      }
      case 'resize': {
        const w = toWorld(e.clientX, e.clientY)
        const orig = drag.orig
        let nx = orig.x
        let ny = orig.y
        let nw = orig.width
        let nh = orig.height
        if (drag.corner === 'nw') {
          nx = w.x; ny = w.y
          nw = orig.x + orig.width - w.x
          nh = orig.y + orig.height - w.y
        } else if (drag.corner === 'ne') {
          ny = w.y
          nw = w.x - orig.x
          nh = orig.y + orig.height - w.y
        } else if (drag.corner === 'sw') {
          nx = w.x
          nw = orig.x + orig.width - w.x
          nh = w.y - orig.y
        } else if (drag.corner === 'se') {
          nw = w.x - orig.x
          nh = w.y - orig.y
        }
        if (nw < 30) nw = 30
        if (nh < 24) nh = 24
        updateElement(canvas.id, drag.id, { x: nx, y: ny, width: nw, height: nh })
        break
      }
      case 'arrow': {
        const w = toWorld(e.clientX, e.clientY)
        setDrag({ ...drag, toX: w.x, toY: w.y })
        break
      }
      case 'marquee': {
        const w = toWorld(e.clientX, e.clientY)
        setDrag({ ...drag, curWorldX: w.x, curWorldY: w.y })
        break
      }
      default:
        break
    }
  }

  const onSvgMouseUp = () => {
    if (drag.kind === 'marquee') {
      const minX = Math.min(drag.startWorldX, drag.curWorldX)
      const maxX = Math.max(drag.startWorldX, drag.curWorldX)
      const minY = Math.min(drag.startWorldY, drag.curWorldY)
      const maxY = Math.max(drag.startWorldY, drag.curWorldY)
      const ids = new Set<ID>()
      if (Math.abs(drag.curWorldX - drag.startWorldX) > 4 || Math.abs(drag.curWorldY - drag.startWorldY) > 4) {
        for (const el of canvas.elements) {
          if (el.type === 'arrow') continue
          if (el.x >= minX && el.x + el.width <= maxX && el.y >= minY && el.y + el.height <= maxY) {
            ids.add(el.id)
          }
        }
      }
      setSelectedIds(ids)
    }
    setDrag({ kind: 'none' })
  }

  const onElementClick = (el: CanvasElement) => (e: MouseEvent) => {
    e.stopPropagation()
    if (tool === 'arrow') {
      if (!arrowFromId) {
        setArrowFromId(el.id)
        setDrag({ kind: 'arrow', fromId: el.id, toX: el.x + el.width / 2, toY: el.y + el.height / 2 })
      } else if (arrowFromId !== el.id) {
        addElement(canvas.id, {
          type: 'arrow',
          x: 0, y: 0, width: 0, height: 0,
          text: '',
          fromId: arrowFromId,
          toId: el.id,
        })
        setArrowFromId(null)
        setDrag({ kind: 'none' })
        setTool('select')
      }
      return
    }
    if (e.shiftKey) toggleInSelection(el.id)
    else selectOnly(el.id)
  }

  const onElementStartMove = (el: CanvasElement) => (e: MouseEvent) => {
    if (tool !== 'select') return
    if (e.button !== 0) return
    e.stopPropagation()
    let workingSet = selectedIds
    if (!selectedIds.has(el.id)) {
      workingSet = new Set([el.id])
      setSelectedIds(workingSet)
    }
    const w = toWorld(e.clientX, e.clientY)
    setDrag({
      kind: 'move',
      ids: Array.from(workingSet),
      lastWorldX: w.x,
      lastWorldY: w.y,
    })
  }

  const onElementResize = (el: CanvasElement) => (corner: ResizeCorner) => {
    setDrag({ kind: 'resize', id: el.id, corner, orig: el })
  }

  // Multi-selection bbox для подсветки.
  const selectionBox = (() => {
    if (selectedIds.size <= 1) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    let any = false
    for (const id of selectedIds) {
      const el = elementsMap.get(id)
      if (!el || el.type === 'arrow') continue
      any = true
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + el.width)
      maxY = Math.max(maxY, el.y + el.height)
    }
    if (!any) return null
    return { x: minX - 4, y: minY - 4, width: maxX - minX + 8, height: maxY - minY + 8 }
  })()

  function renderArrow(arrow: CanvasElement) {
    const from = arrow.fromId ? elementsMap.get(arrow.fromId) : undefined
    const to = arrow.toId ? elementsMap.get(arrow.toId) : undefined
    if (!from || !to) return null
    const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
    const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 }
    const a = anchorPoint(from, toCenter.x, toCenter.y)
    const b = anchorPoint(to, fromCenter.x, fromCenter.y)
    const isSelected = selectedIds.has(arrow.id)
    return (
      <g
        key={arrow.id}
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          selectOnly(arrow.id)
        }}
      >
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12} />
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={isSelected ? '#37352f' : '#787774'}
          strokeWidth={isSelected ? 2 : 1.5}
          markerEnd="url(#arrowhead)"
        />
      </g>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <CanvasToolbar
        title={canvas.title}
        onRename={(v) => renameCanvas(canvas.id, v)}
        tool={tool}
        onTool={(t) => {
          setTool(t)
          setArrowFromId(null)
        }}
        zoom={viewport.zoom}
        onZoomIn={() => setZoom(viewport.zoom * 1.2)}
        onZoomOut={() => setZoom(viewport.zoom / 1.2)}
        onZoomReset={() => reset()}
        elementsCount={canvas.elements.length}
      />

      <div className="relative flex-1 overflow-hidden">
        <svg
          ref={ref}
          className={`canvas-grid absolute inset-0 h-full w-full ${
            tool !== 'select' && tool !== 'arrow'
              ? 'cursor-crosshair'
              : drag.kind === 'pan'
                ? 'cursor-grabbing'
                : spacePressed.current
                  ? 'cursor-grab'
                  : 'cursor-default'
          }`}
          onMouseDown={onSvgMouseDown}
          onMouseMove={onSvgMouseMove}
          onMouseUp={onSvgMouseUp}
          onMouseLeave={onSvgMouseUp}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,10 L10,5 z" fill="#787774" />
            </marker>
          </defs>

          <g transform={`translate(${viewport.pan.x},${viewport.pan.y}) scale(${viewport.zoom})`}>
            {selectionBox && (
              <rect
                x={selectionBox.x}
                y={selectionBox.y}
                width={selectionBox.width}
                height={selectionBox.height}
                fill="rgba(35,131,226,0.05)"
                stroke="rgba(35,131,226,0.6)"
                strokeWidth={1}
                strokeDasharray="3 3"
                pointerEvents="none"
              />
            )}

            {canvas.elements.filter((e) => e.type === 'arrow').map(renderArrow)}

            {drag.kind === 'arrow' &&
              (() => {
                const from = elementsMap.get(drag.fromId)
                if (!from) return null
                const a = anchorPoint(from, drag.toX, drag.toY)
                return (
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={drag.toX}
                    y2={drag.toY}
                    stroke="#787774"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                )
              })()}

            {canvas.elements
              .filter((e) => e.type !== 'arrow')
              .map((el) => (
                <CanvasNode
                  key={el.id}
                  element={el}
                  selected={selectedIds.has(el.id)}
                  hovered={hoveredId === el.id}
                  editing={editingId === el.id}
                  onClick={onElementClick(el)}
                  onPickStartMove={onElementStartMove(el)}
                  onPickStartResize={onElementResize(el)}
                  onDoubleClick={() => setEditingId(el.id)}
                  onPointerEnter={() => setHoveredId(el.id)}
                  onPointerLeave={() => setHoveredId((id) => (id === el.id ? null : id))}
                  onTextChange={(text) => {
                    updateElement(canvas.id, el.id, { text })
                    setEditingId(null)
                  }}
                />
              ))}

            {drag.kind === 'marquee' && (
              <rect
                x={Math.min(drag.startWorldX, drag.curWorldX)}
                y={Math.min(drag.startWorldY, drag.curWorldY)}
                width={Math.abs(drag.curWorldX - drag.startWorldX)}
                height={Math.abs(drag.curWorldY - drag.startWorldY)}
                fill="rgba(35,131,226,0.05)"
                stroke="rgba(35,131,226,0.5)"
                strokeWidth={1}
                pointerEvents="none"
              />
            )}
          </g>
        </svg>

        {canvas.elements.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="max-w-xs text-center">
              <h3 className="title-serif text-xl font-semibold text-ink">Пустой канвас</h3>
              <p className="mt-1 text-sm text-ink-light">
                Нажмите B / S / T / M или выберите инструмент сверху и кликните по холсту.
              </p>
            </div>
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="absolute right-4 top-4 flex items-center gap-1 rounded-md border border-line bg-paper p-1 shadow-notion">
            <button
              className="rounded p-1 text-ink-light hover:bg-paper-hover hover:text-red-600"
              onClick={() => {
                for (const id of selectedIds) deleteElement(canvas.id, id)
                setSelectedIds(new Set())
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
