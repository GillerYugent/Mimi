import { ReactNode } from 'react'

interface Props {
  breadcrumbs?: ReactNode
  actions?: ReactNode
}

export function Topbar({ breadcrumbs, actions }: Props) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-line bg-paper px-4">
      <div className="flex min-w-0 items-center gap-1 text-sm text-ink-light">{breadcrumbs}</div>
      <div className="flex items-center gap-1">{actions}</div>
    </div>
  )
}

export function Crumb({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded px-1.5 py-0.5 text-sm text-ink-light transition-colors hover:bg-paper-hover hover:text-ink"
    >
      {children}
    </button>
  )
}

export function CrumbSep() {
  return <span className="text-ink-lighter">/</span>
}
