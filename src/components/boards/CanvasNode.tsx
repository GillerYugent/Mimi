import { MouseEvent } from 'react'
import type { CanvasElement } from '@/types'

export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'

interface Props {
  element: CanvasElement
  selected: boolean
  editing: boolean
  hovered: boolean
  onPickStartMove: (e: MouseEvent) => void
  onPickStartResize: (corner: ResizeCorner, e: MouseEvent) => void
  onClick: (e: MouseEvent) => void
  onDoubleClick: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  onTextChange: (text: string) => void
}

// ─── Color palette ───────────────────────────────────────────────────────────
export const NODE_COLORS: Array<{ key: string; fill: string; stroke: string; text: string }> = [
  { key: 'white',  fill: '#ffffff',  stroke: '#d6d5d0', text: '#37352f' },
  { key: 'yellow', fill: '#fef9c3',  stroke: '#fde047', text: '#713f12' },
  { key: 'pink',   fill: '#ffe4e6',  stroke: '#fda4af', text: '#881337' },
  { key: 'green',  fill: '#dcfce7',  stroke: '#86efac', text: '#14532d' },
  { key: 'blue',   fill: '#dbeafe',  stroke: '#93c5fd', text: '#1e3a5f' },
  { key: 'purple', fill: '#ede9fe',  stroke: '#c4b5fd', text: '#3b0764' },
  { key: 'orange', fill: '#ffedd5',  stroke: '#fdba74', text: '#7c2d12' },
  { key: 'dark',   fill: '#1e293b',  stroke: '#475569', text: '#e2e8f0' },
]

const DEFAULT_STICKER_COLOR = NODE_COLORS[1] // yellow
const DEFAULT_BLOCK_COLOR   = NODE_COLORS[0] // white

function resolveColor(el: CanvasElement) {
  const found = NODE_COLORS.find((c) => c.key === el.color)
  if (found) return found
  return el.type === 'sticker' ? DEFAULT_STICKER_COLOR : DEFAULT_BLOCK_COLOR
}

const STROKE_HOVER     = '#9b9a97'
const STROKE_SELECTED  = '#2383e2'

export function CanvasNode({
  element: el,
  selected,
  editing,
  hovered,
  onPickStartMove,
  onPickStartResize,
  onClick,
  onDoubleClick,
  onPointerEnter,
  onPointerLeave,
  onTextChange,
}: Props) {
  const colorDef = resolveColor(el)
  const fill     = el.type === 'text' ? 'transparent' : colorDef.fill
  const stroke   = selected ? STROKE_SELECTED : hovered ? STROKE_HOVER : colorDef.stroke
  const strokeWidth = selected ? 2 : 1
  const textColor   = el.type === 'text' ? '#37352f' : colorDef.text

  const isEllipse = el.type === 'mind_node'
  const isSticker = el.type === 'sticker'
  const radius    = isSticker ? 10 : el.type === 'text' ? 4 : 6

  return (
    <g
      data-element-id={el.id}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      onMouseDown={onPickStartMove}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{ cursor: 'move' }}
    >
      {/* Shadow for depth */}
      {el.type !== 'text' && !isEllipse && (
        <rect
          x={el.x + 2}
          y={el.y + 3}
          width={el.width}
          height={el.height}
          fill="rgba(15, 15, 15, 0.08)"
          rx={radius}
          pointerEvents="none"
        />
      )}

      {/* Shape */}
      {el.type !== 'text' &&
        (isEllipse ? (
          <ellipse
            cx={el.x + el.width / 2}
            cy={el.y + el.height / 2}
            rx={el.width / 2}
            ry={el.height / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        ) : (
          <rect
            x={el.x}
            y={el.y}
            width={el.width}
            height={el.height}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            rx={radius}
          />
        ))}

      {/* Sticker corner fold */}
      {isSticker && !editing && (
        <path
          d={`M ${el.x + el.width - 16} ${el.y} L ${el.x + el.width} ${el.y + 16}`}
          stroke={colorDef.stroke}
          strokeWidth={1}
          fill="none"
          pointerEvents="none"
          opacity={0.6}
        />
      )}

      {/* Text / Editing */}
      <foreignObject x={el.x} y={el.y} width={el.width} height={el.height}>
        {editing ? (
          <textarea
            autoFocus
            defaultValue={el.text}
            onBlur={(e) => onTextChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ;(e.target as HTMLTextAreaElement).blur()
              }
              e.stopPropagation()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Введите текст..."
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              resize: 'none',
              outline: 'none',
              padding: isSticker ? '10px 12px' : '8px',
              fontSize: 13,
              textAlign: el.type === 'text' ? 'left' : 'center',
              color: textColor,
              fontFamily: 'inherit',
              lineHeight: 1.4,
            }}
          />
        ) : (
          <div
            className={`flex h-full w-full px-2 ${
              el.type === 'text' ? 'items-start justify-start font-semibold text-left' : 'items-center justify-center text-center'
            }`}
            style={{ color: textColor, pointerEvents: 'none', fontSize: 13, lineHeight: 1.4, padding: isSticker ? '10px 12px' : '8px', boxSizing: 'border-box' }}
          >
            {el.text
              ? <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{el.text}</span>
              : <span style={{ color: el.type === 'text' ? '#9b9a97' : `${textColor}66`, fontSize: 12 }}>
                  {el.type === 'text' ? 'Текст' : 'Двойной клик для редактирования'}
                </span>
            }
          </div>
        )}
      </foreignObject>

      {/* Resize handles */}
      {selected && el.type !== 'text' && !editing && (
        <>
          <ResizeHandle x={el.x}              y={el.y}               corner="nw" onPick={onPickStartResize} />
          <ResizeHandle x={el.x + el.width}   y={el.y}               corner="ne" onPick={onPickStartResize} />
          <ResizeHandle x={el.x}              y={el.y + el.height}   corner="sw" onPick={onPickStartResize} />
          <ResizeHandle x={el.x + el.width}   y={el.y + el.height}   corner="se" onPick={onPickStartResize} />
        </>
      )}
    </g>
  )
}

function ResizeHandle({
  x,
  y,
  corner,
  onPick,
}: {
  x: number
  y: number
  corner: ResizeCorner
  onPick: (corner: ResizeCorner, e: MouseEvent) => void
}) {
  const cursor = corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize'
  return (
    <rect
      x={x - 5}
      y={y - 5}
      width={10}
      height={10}
      fill="#ffffff"
      stroke={STROKE_SELECTED}
      strokeWidth={1.5}
      rx={2}
      style={{ cursor }}
      onMouseDown={(e) => {
        e.stopPropagation()
        onPick(corner, e)
      }}
    />
  )
}
