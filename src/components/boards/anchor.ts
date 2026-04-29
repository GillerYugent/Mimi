import type { CanvasElement } from '@/types'

// Возвращает точку на границе элемента, в которую должна упереться стрелка,
// проведённая из этого элемента в (toX, toY). Это даёт «приклеивание» к
// краям, как в Miro / Figma, вместо некрасивой стрелки от центра в центр.
//
// Для прямоугольника пересекаем луч из центра до целевой точки с границей.
// Для эллипса (mind_node) — пересекаем с эллипсом по параметру.
export function anchorPoint(el: CanvasElement, toX: number, toY: number): { x: number; y: number } {
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const dx = toX - cx
  const dy = toY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  if (el.type === 'mind_node') {
    // Эллипс: ищем точку (cx + a*cos t, cy + b*sin t) на луче.
    const a = el.width / 2
    const b = el.height / 2
    // Параметрическое решение: t такое, что (cx + a*cos t - cx)/dx == (cy + b*sin t - cy)/dy
    // Эквивалентно нахождению длины k вдоль направления (dx,dy):
    //   (k*dx)^2 / a^2 + (k*dy)^2 / b^2 = 1
    const k = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b))
    return { x: cx + k * dx, y: cy + k * dy }
  }

  // Прямоугольник: пересекаем луч с осью-aligned bbox.
  const halfW = el.width / 2
  const halfH = el.height / 2
  // Параметр t такой, что центр + t*(dx,dy) попадает на границу.
  const tx = halfW / Math.abs(dx || 1e-9)
  const ty = halfH / Math.abs(dy || 1e-9)
  const t = Math.min(tx, ty)
  return { x: cx + t * dx, y: cy + t * dy }
}
