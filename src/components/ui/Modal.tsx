import { ReactNode, useEffect } from 'react'
import { IconX } from './Icon'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, footer, width = 'md' }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }[width]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${widths} rounded-lg bg-paper shadow-notion-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="text-sm font-semibold text-ink">{title}</div>
            <button onClick={onClose} className="rounded p-1 text-ink-light hover:bg-paper-hover">
              <IconX />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

interface ConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message?: ReactNode
  confirmText?: string
  destructive?: boolean
}

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  destructive,
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      footer={
        <>
          <button className="btn btn-ghost text-sm" onClick={onClose}>
            Отмена
          </button>
          <button
            className={`btn text-sm ${destructive ? 'bg-red-600 text-white hover:bg-red-500' : 'btn-primary'}`}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div className="text-sm text-ink-light">{message}</div>
    </Modal>
  )
}
