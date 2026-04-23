import { ReactNode, useEffect, useRef, useState } from 'react'

interface Props {
  trigger: ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  width?: string
}

export function Dropdown({ trigger, children, align = 'left', width = 'w-56' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={`absolute z-20 mt-1 ${align === 'right' ? 'right-0' : 'left-0'} ${width} rounded-md border border-line bg-paper py-1 shadow-notion-lg`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

interface ItemProps {
  onClick?: () => void
  icon?: ReactNode
  children: ReactNode
  danger?: boolean
  disabled?: boolean
}

export function DropdownItem({ onClick, icon, children, danger, disabled }: ItemProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
        disabled
          ? 'cursor-not-allowed text-ink-lighter'
          : danger
            ? 'text-red-600 hover:bg-red-50'
            : 'text-ink hover:bg-paper-hover'
      }`}
    >
      {icon && <span className="shrink-0 text-ink-light">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
    </button>
  )
}

export function DropdownDivider() {
  return <div className="my-1 h-px bg-line" />
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-lighter">{children}</div>
}
