import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', ...rest },
  ref
) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-ink-light">{label}</span>}
      <input ref={ref} className={`input ${error ? 'border-red-400' : ''} ${className}`} {...rest} />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className = '', ...rest },
  ref
) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-ink-light">{label}</span>}
      <textarea
        ref={ref}
        className={`input resize-y ${error ? 'border-red-400' : ''} ${className}`}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
})
