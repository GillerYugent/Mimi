import { useEffect, useRef, useState } from 'react'

// Viewport hook: pan + smooth wheel-zoom вокруг курсора, как в Miro.
//
// Координатная модель:
//   screen → world: world = (screen - pan) / zoom
//   world → screen: screen = world * zoom + pan
//
// Zoom меняется лимитированно (0.2 .. 4.0). При прокрутке колеса мы
// сохраняем мировую точку под курсором: пользователь приближает то,
// что под курсором, а не центр канваса.

export interface Viewport {
  pan: { x: number; y: number }
  zoom: number
}

export interface ViewportControls {
  viewport: Viewport
  setPan: (p: { x: number; y: number }) => void
  setZoom: (z: number, centerScreen?: { x: number; y: number }) => void
  reset: () => void
  // Преобразование экранных (clientX/Y относительно ref.current) в world
  // координаты канваса.
  toWorld: (screenX: number, screenY: number) => { x: number; y: number }
}

const ZOOM_MIN = 0.2
const ZOOM_MAX = 4.0

export function useCanvasViewport<T extends Element>(): {
  ref: React.RefObject<T>
  controls: ViewportControls
} {
  const ref = useRef<T>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoomState] = useState(1)

  const setZoom: ViewportControls['setZoom'] = (z, centerScreen) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
    if (centerScreen && ref.current) {
      const rect = (ref.current as unknown as HTMLElement).getBoundingClientRect()
      const cx = centerScreen.x - rect.left
      const cy = centerScreen.y - rect.top
      // Сохраняем точку (cx, cy) экрана инвариантной в world-координатах.
      const worldX = (cx - pan.x) / zoom
      const worldY = (cy - pan.y) / zoom
      const newPanX = cx - worldX * clamped
      const newPanY = cy - worldY * clamped
      setPan({ x: newPanX, y: newPanY })
    }
    setZoomState(clamped)
  }

  // Глобальный non-passive wheel listener: только так можно вызвать
  // preventDefault внутри React (default React-обработчики passive).
  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // Ctrl+wheel = зум (как трекпад pinch/zoom). Простой wheel — pan по Y.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = -e.deltaY * 0.0015
        const next = zoom * Math.exp(delta)
        setZoom(next, { x: e.clientX, y: e.clientY })
      } else {
        // Pan with wheel (как Miro со средней кнопкой / shift).
        e.preventDefault()
        setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [pan.x, pan.y, zoom])

  const toWorld: ViewportControls['toWorld'] = (sx, sy) => {
    const rect = (ref.current as unknown as HTMLElement | null)?.getBoundingClientRect()
    const x = (sx - (rect?.left ?? 0) - pan.x) / zoom
    const y = (sy - (rect?.top ?? 0) - pan.y) / zoom
    return { x, y }
  }

  return {
    ref,
    controls: {
      viewport: { pan, zoom },
      setPan,
      setZoom,
      reset: () => {
        setPan({ x: 0, y: 0 })
        setZoomState(1)
      },
      toWorld,
    },
  }
}
