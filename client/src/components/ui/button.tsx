import * as React from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg' | 'round-icon'

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-primary text-primary-foreground hover:opacity-90',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-muted transition-colors',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/70 transition-colors',
  ghost:
    'bg-transparent text-foreground hover:bg-muted hover:text-foreground transition-colors',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 transition-colors',
  link:
    'bg-transparent text-primary underline-offset-4 hover:underline',
}

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-9 px-4 py-2 text-sm rounded-lg',
  sm: 'h-7 px-3 py-1 text-xs rounded-md',
  lg: 'h-11 px-6 text-base rounded-lg',
  icon: 'h-9 w-9 rounded-lg',
  'icon-sm': 'h-7 w-7 rounded-md',
  'icon-lg': 'h-11 w-11 rounded-lg',
  'round-icon': 'h-10 w-10 rounded-full',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          'cursor-pointer select-none',
          '[&_svg]:pointer-events-none [&_svg]:shrink-0',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button }
export type { ButtonVariant, ButtonSize }
