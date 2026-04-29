import { MouseEvent } from 'react'
import type { CanvasElement } from '@/types'

export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'

interface Props {
  element: CanvasElement
  selected: boolean
  editing: boolean
  hovered: boolean
  // Хэндлеры; координаты в screen-space (clientX/Y), вызывающий приведёт в world.
  onPickStartMove: (e: MouseEvent) => void
  onPickStartResize: (corner: ResizeCorner, e: MouseEvent) => void
  onClick: (e: MouseEvent) => void
  onDoubleClick: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  onTextChange: (text: string) => void
}

const STROKE_DEFAULT = '#d6d5d0'
const STROKE_HOVER = '#9b9a97'
const STROKE_SELECTED = '#37352f'
const FILL_BLOCK = '#ffffff'
const FILL_STICKER = '#fbfbfa'

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
  const stroke = selected ? STROKE_SELECTED : hovered ? STROKE_HOVER : STROKE_DEFAULT
  const strokeWidth = selected ? 2 : 1
  const fill =
    el.type === 'sticker'
      ? FILL_STICKER
      : el.type === 'text'
        ? 'transparent'
        : FILL_BLOCK

  const isEllipse = el.type === 'mind_node'
  const isSticker = el.type === 'sticker'
  const radius = isSticker ? 10 : el.type === 'text' ? 4 : 6

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
      {/* Лёгкая «тень» для блоков и стикеров — Miro-like depth */}
      {el.type !== 'text' && !isEllipse && (
        <rect
          x={el.x + 2}
          y={el.y + 3}
          width={el.width}
          height={el.height}
          fill="rgba(15, 15, 15, 0.06)"
          rx={radius}
          pointerEvents="none"
        />
      )}

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
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              resize: 'none',
              outline: 'none',
              padding: 8,
              fontSize: 13,
              textAlign: el.type === 'text' ? 'left' : 'center',
              color: '#37352f',
              fontFamily: 'inherit',
              lineHeight: 1.4,
            }}
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center px-2 text-center text-[13px] leading-tight ${
              el.type === 'text' ? 'justify-start font-semibold' : ''
            }`}
            style={{ color: '#37352f', pointerEvents: 'none' }}
          >
            {el.text || <span className="text-ink-lighter">Дважды кликните, чтобы изменить</span>}
          </div>
        )}
      </foreignObject>

      {/* Ручки изменения размера — только для прямоугольных элементов и при выделении */}
      {selected && el.type !== 'text' && !editing && (
        <>
          <ResizeHandle x={el.x} y={el.y} corner="nw" onPick={onPickStartResize} />
          <ResizeHandle x={el.x + el.width} y={el.y} corner="ne" onPick={onPickStartResize} />
          <ResizeHandle x={el.x} y={el.y + el.height} corner="sw" onPick={onPickStartResize} />
          <ResizeHandle x={el.x + el.width} y={el.y + el.height} corner="se" onPick={onPickStartResize} />
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
  const cursor =
    corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize'
  return (
    <rect
      x={x - 4}
      y={y - 4}
      width={8}
      height={8}
      fill="#ffffff"
      stroke="#37352f"
      strokeWidth={1.2}
      rx={1}
      style={{ cursor }}
      onMouseDown={(e) => {
        e.stopPropagation()
        onPick(corner, e)
      }}
    />
  )
}
