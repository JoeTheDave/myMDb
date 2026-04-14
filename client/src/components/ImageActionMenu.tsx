import { useState, useRef, useEffect, useCallback } from 'react'
import { MoreHorizontal, X } from 'lucide-react'
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
  triggerHoverClass?: string
}

// Distribute N buttons over a 90° arc from left (180°) to up (90°),
// all staying within the image bounds when the trigger sits in the bottom-right corner.
// Uses standard math angles (counterclockwise from +x axis), with CSS y-axis flipped.
const RADIUS = 44

function radialPositions(count: number): { dx: number; dy: number }[] {
  if (count === 0) return []
  const startDeg = 180
  const endDeg = 90
  const arc = startDeg - endDeg // 90°
  return Array.from({ length: count }, (_, i) => {
    const deg = count === 1 ? 135 : startDeg - (arc / (count - 1)) * i
    const rad = (deg * Math.PI) / 180
    return {
      dx: RADIUS * Math.cos(rad),   // negative = left  (safe for bottom-right corner)
      dy: -RADIUS * Math.sin(rad),  // negative = up    (safe for bottom-right corner)
    }
  })
}

export function ImageActionMenu({
  actions,
  className,
  triggerHoverClass = 'group-hover:opacity-100',
}: ImageActionMenuProps) {
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

  const positions = radialPositions(actions.length)

  return (
    <div
      ref={containerRef}
      className={cn('absolute bottom-1.5 right-1.5 z-20', className)}
    >
      {/* Radial action buttons — positioned relative to the trigger */}
      {actions.map((action, i) => {
        const pos = positions[i]
      if (!pos) return null
      const { dx, dy } = pos
        return (
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
              position: 'absolute',
              bottom: 0,
              right: 0,
              transform: open ? `translate(${dx}px, ${dy}px)` : 'translate(0, 0)',
              opacity: open ? 1 : 0,
              pointerEvents: open ? 'auto' : 'none',
              transitionDelay: open ? `${i * 40}ms` : '0ms',
            }}
            className={cn(
              'size-6 rounded-full text-white flex items-center justify-center',
              'transition-all duration-200',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              action.destructive ? 'bg-red-600/80' : 'bg-black/60',
            )}
          >
            {action.icon}
          </button>
        )
      })}

      {/* Trigger */}
      <button
        type="button"
        title="More actions"
        onClick={e => {
          e.stopPropagation()
          setOpen(prev => !prev)
        }}
        className={cn(
          'relative size-6 rounded-full text-white flex items-center justify-center',
          'transition-all duration-150',
          open
            ? 'bg-white/20 opacity-100'
            : cn('bg-black/60 opacity-0', triggerHoverClass, '[@media(hover:none)]:opacity-100'),
        )}
      >
        {open ? <X className="size-3.5" /> : <MoreHorizontal className="size-3.5" />}
      </button>
    </div>
  )
}
