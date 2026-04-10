import * as React from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectContextType {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextType>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
})

type SelectSize = 'default' | 'sm'

const triggerSizeClasses: Record<SelectSize, string> = {
  default: 'h-9 text-sm px-3',
  sm: 'h-7 text-xs px-2.5',
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
  size?: SelectSize
  placeholder?: string
}

function Select({ value, onValueChange, children, className, size = 'default', placeholder }: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Find the display label for the current value from children
  let displayLabel: React.ReactNode = null
  React.Children.forEach(children, child => {
    if (React.isValidElement(child) && (child.props as { value?: string }).value === value && value !== '') {
      displayLabel = (child.props as { children?: React.ReactNode }).children
    }
  })

  React.useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div ref={containerRef} className={cn('relative', className)}>
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'w-full flex items-center justify-between gap-2 rounded-lg',
            'border border-border bg-input text-foreground',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent',
            'cursor-pointer select-none',
            triggerSizeClasses[size],
          )}
        >
          <span className={cn('truncate', !displayLabel && 'text-muted-foreground')}>
            {displayLabel ?? placeholder ?? 'Select…'}
          </span>
          <ChevronDown
            className={cn(
              'shrink-0 text-muted-foreground transition-transform duration-150',
              size === 'sm' ? 'size-3.5' : 'size-4',
              open && 'rotate-180',
            )}
          />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div
            role="listbox"
            className={cn(
              'absolute z-50 top-full mt-1 left-0 right-0',
              'bg-popover border border-border rounded-lg shadow-xl',
              'py-1 max-h-60 overflow-y-auto',
            )}
          >
            {children}
          </div>
        )}
      </div>
    </SelectContext.Provider>
  )
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

function SelectItem({ value, children, className }: SelectItemProps) {
  const { value: selectedValue, onValueChange, setOpen } = React.useContext(SelectContext)
  const isSelected = value !== '' && value === selectedValue

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      className={cn(
        'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm',
        'text-left cursor-pointer transition-colors duration-100',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:bg-accent',
        isSelected
          ? 'text-primary font-medium'
          : value === ''
            ? 'text-muted-foreground'
            : 'text-foreground',
        className,
      )}
      onClick={() => {
        onValueChange(value)
        setOpen(false)
      }}
    >
      <span>{children}</span>
      {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
    </button>
  )
}

export { Select, SelectItem }
