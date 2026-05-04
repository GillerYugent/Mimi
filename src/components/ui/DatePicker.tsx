import { useEffect, useRef, useState } from 'react'

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function parseDate(value: string): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  date.setHours(0, 0, 0, 0)
  return date
}

function toValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toDisplay(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function buildGrid(year: number, month: number): Array<{ date: Date; current: boolean }> {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  // Monday-based week: Mon=0 … Sun=6
  const startOffset = (firstDay.getDay() + 6) % 7
  const cells: Array<{ date: Date; current: boolean }> = []

  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), current: false })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), current: true })
  }
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(year, month + 1, d), current: false })
    }
  }
  return cells
}

interface Props {
  value: string // YYYY-MM-DD
  onChange: (v: string) => void
  label?: string
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
  /** Hides the trigger visually until parent is hovered (for inline row usage) */
  ghost?: boolean
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'дд.мм.гггг',
  className = '',
  size = 'md',
  ghost = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = parseDate(value)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [view, setView] = useState(() => {
    const d = selected || new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  // Sync view when value changes externally
  useEffect(() => {
    if (selected) setView({ year: selected.getFullYear(), month: selected.getMonth() })
  }, [value])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const prevMonth = () =>
    setView((v) => {
      const d = new Date(v.year, v.month - 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  const nextMonth = () =>
    setView((v) => {
      const d = new Date(v.year, v.month + 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  const grid = buildGrid(view.year, view.month)

  const pick = (d: Date) => {
    onChange(toValue(d))
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <span className="mb-1 block text-xs font-medium text-ink-light">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`input flex cursor-pointer items-center justify-between gap-2 text-left ${
          size === 'sm' ? 'py-1.5 text-xs' : ''
        } ${!value ? 'text-ink-lighter' : 'text-ink'} ${
          ghost ? 'w-auto border-transparent bg-transparent shadow-none hover:border-line hover:bg-paper-hover' : 'w-full'
        }`}
      >
        <span className="flex-1 truncate">{selected ? toDisplay(selected) : placeholder}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 text-ink-lighter"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-72 rounded-md border border-line bg-paper shadow-notion-lg">
          {/* Header */}
          <div className="flex items-center gap-1 border-b border-line px-3 py-2">
            <span className="flex-1 text-sm font-medium text-ink">
              {MONTHS[view.month]} {view.year}
            </span>
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-6 w-6 items-center justify-center rounded text-ink-light transition-colors hover:bg-paper-hover"
              aria-label="Предыдущий месяц"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 15-6-6-6 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-6 w-6 items-center justify-center rounded text-ink-light transition-colors hover:bg-paper-hover"
              aria-label="Следующий месяц"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-3 pt-2 pb-1">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-ink-lighter">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-2">
            {grid.map(({ date, current }, i) => {
              const isToday = date.getTime() === today.getTime()
              const isSelected = !!selected && date.getTime() === selected.getTime()
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(date)}
                  className={`flex h-7 w-full items-center justify-center rounded text-xs transition-colors ${
                    isSelected
                      ? 'bg-ink font-medium text-paper'
                      : isToday
                        ? 'border border-ink/25 font-semibold text-ink hover:bg-paper-hover'
                        : current
                          ? 'text-ink hover:bg-paper-hover'
                          : 'text-ink-lighter hover:bg-paper-hover'
                  }`}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-line px-3 py-2">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs text-ink-light transition-colors hover:text-red-600"
            >
              Удалить
            </button>
            <button
              type="button"
              onClick={() => { onChange(toValue(today)); setOpen(false) }}
              className="text-xs font-medium text-ink-light transition-colors hover:text-ink"
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
