import { useState, useRef, useEffect, useCallback } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActionItem {
  icon: React.ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}

interface ImageActionMenuProps {
  actions: ActionItem[]
  className?: string
}

export function ImageActionMenu({ actions, className }: ImageActionMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, close])

  return (
    <div
      ref={containerRef}
      className={cn('absolute bottom-1.5 right-1.5 z-20 flex flex-col-reverse items-center gap-1', className)}
    >
      {/* Trigger button */}
      <button
        type="button"
        title="More actions"
        onClick={e => {
          e.stopPropagation()
          setOpen(prev => !prev)
        }}
        className={cn(
          'size-6 rounded-full bg-black/60 text-white flex items-center justify-center',
          'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity',
        )}
      >
        <MoreHorizontal className="size-3.5" />
      </button>

      {/* Action buttons */}
      {actions.map((action, i) => (
        <button
          key={i}
          type="button"
          title={action.label}
          disabled={action.disabled}
          onClick={e => {
            e.stopPropagation()
            close()
            action.onClick()
          }}
          style={{
            transitionDelay: open ? `${i * 50}ms` : '0ms',
            transform: open ? 'translateY(0)' : 'translateY(0.5rem)',
            opacity: open ? 1 : 0,
            pointerEvents: open ? 'auto' : 'none',
          }}
          className={cn(
            'size-6 rounded-full text-white flex items-center justify-center',
            'transition-all duration-150',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            action.destructive ? 'bg-destructive/80' : 'bg-black/60',
          )}
        >
          {action.icon}
        </button>
      ))}
    </div>
  )
}
