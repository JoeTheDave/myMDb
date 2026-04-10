import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  onValueChange?: (value: string) => void
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
}

function Select({ className, onValueChange, onChange, children, ...props }: SelectProps) {
  const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    onChange?.(e)
    onValueChange?.(e.target.value)
  }

  return (
    <div className="relative inline-block w-full">
      <select
        className={cn(
          'h-9 w-full appearance-none rounded-lg border border-border',
          'bg-input text-foreground',
          'pl-3 pr-8 py-2 text-sm',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'cursor-pointer',
          className,
        )}
        onChange={handleChange}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
    </div>
  )
}

function SelectItem({ className, children, ...props }: React.OptionHTMLAttributes<HTMLOptionElement>) {
  return (
    <option className={cn('bg-popover text-foreground', className)} {...props}>
      {children}
    </option>
  )
}

export { Select, SelectItem }
