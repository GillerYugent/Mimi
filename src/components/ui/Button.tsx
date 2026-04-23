import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  outline: 'btn-outline',
  danger: 'btn-danger',
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-2.5 py-1.5',
  lg: 'text-sm px-3 py-2',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'ghost', size = 'md', className = '', children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`btn ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})
