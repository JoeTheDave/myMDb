import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, User, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { actorApi, castApi, ApiError } from '@/lib/api'
import type { ActorListItem } from '@/lib/types'

interface AddCastCardProps {
  mediaId: string
  onCastAdded: () => void
}

export function AddCastCard({ mediaId, onCastAdded }: AddCastCardProps) {
  const [active, setActive] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [results, setResults] = useState<ActorListItem[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const cardRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Click outside → cancel
  useEffect(() => {
    if (!active) return
    function handleMouseDown(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        cancel()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [active])

  function cancel() {
    setActive(false)
    setInputValue('')
    setResults([])
    setHighlightedIndex(-1)
  }

  const search = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await actorApi.list({ q: term, limit: 8 })
      setResults(res.items)
      setHighlightedIndex(-1)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void search(val)
    }, 250)
  }

  async function addActorById(actorId: string) {
    setSubmitting(true)
    try {
      await castApi.add(mediaId, { actorId })
      onCastAdded()
      cancel()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Actor is already in this movie's cast")
      } else {
        toast.error('Failed to add cast member')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function createAndAdd() {
    const name = inputValue.trim()
    if (!name) return
    setSubmitting(true)
    try {
      const newActor = await actorApi.create({ name })
      await castApi.add(mediaId, { actorId: newActor.id })
      onCastAdded()
      cancel()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Actor is already in this movie's cast")
      } else {
        toast.error('Failed to add cast member')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      cancel()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(i => Math.min(i + 1, results.length - 1))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => Math.max(i - 1, -1))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (submitting) return

      if (highlightedIndex >= 0 && results[highlightedIndex]) {
        void addActorById(results[highlightedIndex]!.id)
      } else if (results.length === 0 && inputValue.trim()) {
        void createAndAdd()
      } else if (results.length > 0 && highlightedIndex === -1) {
        // Enter with results but none highlighted → create new
        void createAndAdd()
      }
    }
  }

  function activateCard() {
    setActive(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const showCreateHint = inputValue.trim().length > 0 && !searching && results.length === 0

  return (
    <div ref={cardRef} className="relative h-full aspect-[3/4]">
      {!active ? (
        /* Idle state */
        <button
          type="button"
          onClick={activateCard}
          className={cn(
            'w-full h-full min-h-[120px] rounded-xl border-2 border-dashed border-border',
            'bg-card/30 cursor-pointer',
            'hover:border-gold/50 hover:bg-card/60 transition-colors',
            'flex flex-col items-center justify-center gap-2',
          )}
        >
          <Plus className="size-6 text-muted-foreground opacity-60" />
          <span className="text-sm text-muted-foreground">Add Cast</span>
        </button>
      ) : (
        /* Active state */
        <div
          className={cn(
            'h-full min-h-[120px] rounded-xl border border-border bg-card overflow-visible',
            'flex flex-col',
          )}
        >
          <div className="flex-1 flex flex-col items-center justify-center p-3 gap-2">
            {submitting ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={submitting}
                  className={cn(
                    'w-full text-sm text-center bg-transparent border-b border-border',
                    'outline-none text-foreground disabled:opacity-50',
                  )}
                />
                {searching && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Dropdown */}
      {active && !submitting && (results.length > 0 || showCreateHint) && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 mt-1',
            'bg-popover border border-border rounded-lg shadow-lg z-50',
            'overflow-hidden',
          )}
        >
          {results.map((actor, idx) => (
            <button
              key={actor.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); void addActorById(actor.id) }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left',
                'hover:bg-muted/60 transition-colors',
                highlightedIndex === idx && 'bg-muted/60',
              )}
            >
              {actor.imageUrl ? (
                <img
                  src={actor.imageUrl}
                  alt={actor.name}
                  className="size-6 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="size-3.5 text-muted-foreground opacity-50" />
                </div>
              )}
              <span className="text-sm truncate">{actor.name}</span>
            </button>
          ))}

          {showCreateHint && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); void createAndAdd() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
            >
              <Plus className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">
                Press Enter to add &ldquo;{inputValue.trim()}&rdquo; as a new actor
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
