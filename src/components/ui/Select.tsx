import { ReactNode, useEffect, useRef, useState } from 'react'
import { IconCheck, IconChevronDown } from './Icon'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  icon?: ReactNode
}

interface Props<T extends string> {
  value: T | ''
  onChange: (v: T | '') => void
  options: SelectOption<T>[]
  /** Label shown when nothing is selected */
  placeholder?: string
  /** Adds a "clear" entry at the top of the list */
  nullable?: boolean
  nullLabel?: string
  label?: string
  className?: string
  size?: 'sm' | 'md'
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Выберите…',
  nullable,
  nullLabel = '—',
  label,
  className = '',
  size = 'md',
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

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

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <span className="mb-1 block text-xs font-medium text-ink-light">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`input flex w-full cursor-pointer items-center gap-2 text-left ${
          size === 'sm' ? 'py-1.5 text-xs' : ''
        } ${!value ? 'text-ink-lighter' : 'text-ink'}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <IconChevronDown
          size={14}
          className={`shrink-0 text-ink-lighter transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-full min-w-[160px] rounded-md border border-line bg-paper py-1 shadow-notion-lg">
          {nullable && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-ink-light transition-colors hover:bg-paper-hover"
            >
              <span className="flex-1 truncate">{nullLabel}</span>
              {!value && <IconCheck size={13} className="shrink-0 text-ink" />}
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-paper-hover"
            >
              {opt.icon && <span className="shrink-0">{opt.icon}</span>}
              <span className="flex-1 truncate">{opt.label}</span>
              {value === opt.value && <IconCheck size={13} className="shrink-0 text-ink" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
