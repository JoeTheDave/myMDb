import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MediaListParams, ActorListParams } from '@/lib/types'
import { MOVIE_RATINGS, TV_RATINGS, formatContentRating } from '@/lib/types'
import type { ContentRating } from '@/lib/types'

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

// ---- Media filter bar ----

interface MediaFilterBarProps {
  filters: MediaListParams
  onFiltersChange: (filters: MediaListParams) => void
}

export function MediaFilterBar({ filters, onFiltersChange }: MediaFilterBarProps) {
  const [open, setOpen] = useState(false)
  const [localQ, setLocalQ] = useState(filters.q ?? '')
  const [localActorQ, setLocalActorQ] = useState('')
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state when filters reset externally
  useEffect(() => {
    setLocalQ(filters.q ?? '')
  }, [filters.q])

  function handleQChange(val: string) {
    setLocalQ(val)
    if (qTimer.current) clearTimeout(qTimer.current)
    qTimer.current = setTimeout(() => {
      onFiltersChange(compact({ ...filters, q: val || undefined, page: 1 }))
    }, 300)
  }

  function handleActorQChange(val: string) {
    setLocalActorQ(val)
    if (actorTimer.current) clearTimeout(actorTimer.current)
    actorTimer.current = setTimeout(() => {
      onFiltersChange(compact({ ...filters, page: 1 }))
    }, 300)
  }

  function handleTypeChange(type: 'ALL' | 'MOVIE' | 'SHOW') {
    const next = { ...filters, page: 1 }
    delete next['type']
    delete next['contentRating']
    if (type !== 'ALL') {
      next.type = type
    }
    onFiltersChange(compact(next))
  }

  function handleContentRatingToggle(rating: ContentRating) {
    const current = filters.contentRating ? filters.contentRating.split(',') : []
    const next = current.includes(rating) ? current.filter(r => r !== rating) : [...current, rating]
    const updated = { ...filters, page: 1 }
    if (next.length > 0) {
      updated.contentRating = next.join(',')
    } else {
      delete updated['contentRating']
    }
    onFiltersChange(compact(updated))
  }

  function handleYearChange(field: 'yearFrom' | 'yearTo', val: string) {
    const updated = { ...filters, page: 1 }
    if (val) {
      updated[field] = parseInt(val, 10)
    } else {
      delete updated[field]
    }
    onFiltersChange(compact(updated))
  }

  function handleMinRatingChange(val: string) {
    const updated = { ...filters, page: 1 }
    if (val) {
      updated.minRating = parseInt(val, 10)
    } else {
      delete updated['minRating']
    }
    onFiltersChange(compact(updated))
  }

  function clearFilters() {
    setLocalQ('')
    setLocalActorQ('')
    onFiltersChange(compact({ page: 1, limit: filters.limit }))
  }

  const activeType = filters.type ?? 'ALL'
  const selectedRatings = filters.contentRating ? filters.contentRating.split(',') : []
  const ratingOptions =
    activeType === 'MOVIE' ? MOVIE_RATINGS : activeType === 'SHOW' ? TV_RATINGS : [...MOVIE_RATINGS, ...TV_RATINGS]

  const hasActiveFilters = !!(
    filters.q ||
    filters.type ||
    filters.contentRating ||
    filters.yearFrom ||
    filters.yearTo ||
    filters.minRating ||
    filters.actorId
  )

  // suppress unused variable warnings
  void localActorQ
  void handleActorQChange

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
            placeholder="Title, keyword..."
            value={localQ}
            onChange={e => handleQChange(e.target.value)}
          />
        </div>

        {/* Type toggle */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</Label>
          <div className="flex gap-1">
            {(['ALL', 'MOVIE', 'SHOW'] as const).map(t => (
              <Button
                key={t}
                variant={activeType === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeChange(t)}
                className={activeType === t ? 'bg-gold text-black hover:bg-gold/90' : ''}
              >
                {t === 'ALL' ? 'All' : t === 'MOVIE' ? 'Movie' : 'Show'}
              </Button>
            ))}
          </div>
        </div>

        {/* Content rating */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rating</Label>
          <div className="flex flex-wrap gap-1">
            {ratingOptions.map(r => (
              <button
                key={r}
                onClick={() => handleContentRatingToggle(r)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded border transition-colors',
                  selectedRatings.includes(r)
                    ? 'bg-gold text-black border-gold'
                    : 'bg-transparent border-border text-foreground hover:border-gold/60',
                )}
              >
                {formatContentRating(r)}
              </button>
            ))}
          </div>
        </div>

        {/* Year range */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Year</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="From"
              min={1880}
              max={2100}
              value={filters.yearFrom ?? ''}
              onChange={e => handleYearChange('yearFrom', e.target.value)}
              className="w-24"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number"
              placeholder="To"
              min={1880}
              max={2100}
              value={filters.yearTo ?? ''}
              onChange={e => handleYearChange('yearTo', e.target.value)}
              className="w-24"
            />
          </div>
        </div>

        {/* Min rating */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Min Stars</Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => handleMinRatingChange(filters.minRating === n ? '' : String(n))}
                className={cn(
                  'text-sm px-2 py-0.5 rounded border transition-colors',
                  filters.minRating === n
                    ? 'bg-gold text-black border-gold'
                    : 'bg-transparent border-border text-foreground hover:border-gold/60',
                )}
              >
                {n}★
              </button>
            ))}
          </div>
        </div>

        {/* Actor search */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actor</Label>
          <Input
            placeholder="Actor name..."
            value={localActorQ}
            onChange={e => handleActorQChange(e.target.value)}
          />
        </div>

        {/* Clear (desktop) */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="hidden md:flex">
            <X className="size-3.5 mr-1" /> Clear filters
          </Button>
        )}
      </div>
    </div>
  )
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
