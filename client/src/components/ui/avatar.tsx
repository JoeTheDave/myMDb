import * as React from 'react'
import { cn } from '@/lib/utils'

type AvatarSize = 'sm' | 'default' | 'lg'

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'size-6',
  default: 'size-8',
  lg: 'size-10',
}

const fallbackTextClasses: Record<AvatarSize, string> = {
  sm: 'text-xs',
  default: 'text-sm',
  lg: 'text-base',
}

interface AvatarProps {
  size?: AvatarSize
  className?: string
  children?: React.ReactNode
}

function Avatar({ size = 'default', className, children }: AvatarProps) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 rounded-full overflow-hidden',
        'ring-1 ring-border',
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </div>
  )
}

function AvatarImage({ className, src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [error, setError] = React.useState(false)

  if (error || !src) return null

  return (
    <img
      src={src}
      alt={alt}
      className={cn('aspect-square size-full object-cover', className)}
      onError={() => setError(true)}
      {...props}
    />
  )
}

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: AvatarSize
}

function AvatarFallback({ className, size = 'default', children, ...props }: AvatarFallbackProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center',
        'bg-muted text-muted-foreground font-medium',
        fallbackTextClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Avatar, AvatarImage, AvatarFallback }
