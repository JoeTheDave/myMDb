import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActorListParams } from '@/lib/types'

// Strips keys with undefined values to satisfy exactOptionalPropertyTypes
function compact<T extends object>(obj: T): T {
  const result: Partial<T> = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }
  return result as T
}

// ---- Actor filter bar ----

interface ActorFilterBarProps {
  filters: ActorListParams
  onFiltersChange: (filters: ActorListParams) => void
}

export function ActorFilterBar({ filters, onFiltersChange }: ActorFilterBarProps) {
  const [open, setOpen] = useState(false)
  const [localQ, setLocalQ] = useState(filters.q ?? '')
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalQ(filters.q ?? '')
  }, [filters.q])

  function handleQChange(val: string) {
    setLocalQ(val)
    if (qTimer.current) clearTimeout(qTimer.current)
    qTimer.current = setTimeout(() => {
      const updated = { ...filters, page: 1 }
      if (val) {
        updated.q = val
      } else {
        delete updated['q']
      }
      onFiltersChange(compact(updated))
    }, 300)
  }

  function handleBirthYearChange(field: 'birthYearFrom' | 'birthYearTo', val: string) {
    const updated = { ...filters, page: 1 }
    if (val) {
      updated[field] = parseInt(val, 10)
    } else {
      delete updated[field]
    }
    onFiltersChange(compact(updated))
  }

  function handleDeceasedToggle() {
    const updated = { ...filters, page: 1 }
    if (filters.deceased) {
      delete updated['deceased']
    } else {
      updated.deceased = true
    }
    onFiltersChange(compact(updated))
  }

  function clearFilters() {
    setLocalQ('')
    onFiltersChange(compact({ page: 1, limit: filters.limit }))
  }

  const hasActiveFilters = !!(filters.q || filters.birthYearFrom || filters.birthYearTo || filters.deceased)

  return (
    <div className="space-y-3">
      {/* Mobile toggle */}
      <div className="flex items-center gap-2 md:hidden">
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          <SlidersHorizontal className="size-4 mr-1.5" />
          Filters
          {hasActiveFilters && (
            <Badge className="ml-1.5 size-4 p-0 flex items-center justify-center bg-gold text-black text-xs">
              !
            </Badge>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="size-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      <div className={cn('space-y-4', open ? 'block' : 'hidden md:block')}>
        {/* Search */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
          <Input
            placeholder="Actor name..."
            value={localQ}
            onChange={e => handleQChange(e.target.value)}
          />
        </div>

        {/* Birth year range */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Birth Year</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="From"
              min={1800}
              max={2100}
              value={filters.birthYearFrom ?? ''}
              onChange={e => handleBirthYearChange('birthYearFrom', e.target.value)}
              className="w-24"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number"
              placeholder="To"
              min={1800}
              max={2100}
              value={filters.birthYearTo ?? ''}
              onChange={e => handleBirthYearChange('birthYearTo', e.target.value)}
              className="w-24"
            />
          </div>
        </div>

        {/* Deceased toggle */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
          <Button
            variant={filters.deceased ? 'default' : 'outline'}
            size="sm"
            onClick={handleDeceasedToggle}
            className={filters.deceased ? 'bg-gold text-black hover:bg-gold/90' : ''}
          >
            Deceased only
          </Button>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="hidden md:flex">
            <X className="size-3.5 mr-1" /> Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
