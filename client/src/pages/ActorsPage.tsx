import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Settings, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { actorApi } from '@/lib/api'
import { hasMinRole } from '@/lib/types'
import { ActorCard } from '@/components/ActorCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const NAVBAR_HEIGHT = 56 // px — matches h-14 in Navbar

function ActorCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border animate-pulse">
      <div className="aspect-[3/4] bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
    </div>
  )
}

export function ActorsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isEditor = user ? hasMinRole(user.role, 'EDITOR') : false

  const [searchInput, setSearchInput] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const [gearOpen, setGearOpen] = useState(false)
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false)
  const gearRef = useRef<HTMLDivElement>(null)

  // Close gear dropdown on outside click
  useEffect(() => {
    if (!gearOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) {
        setGearOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [gearOpen])

  const purgeMutation = useMutation({
    mutationFn: () => actorApi.purge(),
    onSuccess: (data) => {
      setPurgeDialogOpen(false)
      if (data.deleted === 0) {
        toast.success('No actors to purge.')
      } else {
        toast.success(`${data.deleted} actor${data.deleted === 1 ? '' : 's'} deleted.`)
      }
      void queryClient.invalidateQueries({ queryKey: ['actors'] })
    },
    onError: () => {
      toast.error('Failed to purge actors')
    },
  })

  // 2-second debounce on search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setCommittedSearch(searchInput)
    }, 2000)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['actors', { limit: 24, q: committedSearch }],
    queryFn: ({ pageParam = 1 }) => actorApi.list({
      page: pageParam as number,
      limit: 24,
      ...(committedSearch ? { q: committedSearch } : {}),
    }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  })

  const items = data?.pages.flatMap(p => p.items) ?? []

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const SUB_HEADER_HEIGHT = 60

  return (
    <>
      {/* Fixed sub-header: search + add button */}
      <div
        className="fixed left-0 right-0 z-10 border-b border-border"
        style={{ top: NAVBAR_HEIGHT }}
      >
        {/* Layered background for frosted effect */}
        <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />

        <div className="relative container mx-auto px-4 flex items-center gap-3" style={{ height: SUB_HEADER_HEIGHT }}>
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search actors…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm
                bg-input border border-border text-foreground
                placeholder:text-muted-foreground
                transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
            />
          </div>

          {/* Round add button + gear menu */}
          {isEditor && (
            <>
              <Link to="/actors/new">
                <Button
                  variant="default"
                  size="round-icon"
                  aria-label="Add Actor"
                  title="Add Actor"
                >
                  <Plus className="size-5" />
                </Button>
              </Link>

              {/* Gear menu */}
              <div ref={gearRef} className="relative">
                <Button
                  variant="outline"
                  size="round-icon"
                  aria-label="Actor options"
                  title="Actor options"
                  onClick={() => setGearOpen(prev => !prev)}
                >
                  <Settings className="size-5" />
                </Button>

                {gearOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-border bg-popover shadow-lg z-20 py-1 overflow-hidden">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                      onClick={() => {
                        setGearOpen(false)
                        setPurgeDialogOpen(true)
                      }}
                    >
                      <Trash2 className="size-4 shrink-0" />
                      Purge Actors
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Purge confirmation dialog */}
      {purgeDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !purgeMutation.isPending && setPurgeDialogOpen(false)}
          />
          {/* Dialog */}
          <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Purge actors without movies?</h2>
            <p className="text-sm text-muted-foreground">
              This will permanently delete all actors who are not in any movie. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="default"
                disabled={purgeMutation.isPending}
                onClick={() => setPurgeDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="default"
                disabled={purgeMutation.isPending}
                onClick={() => purgeMutation.mutate()}
              >
                {purgeMutation.isPending ? 'Purging…' : 'Purge'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Page content — padded to clear navbar + sub-header */}
      <div
        className="container mx-auto px-4 py-6"
        style={{ paddingTop: SUB_HEADER_HEIGHT + 24 }}
      >
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {Array.from({ length: 24 }, (_, i) => (
              <ActorCardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <p className="text-lg font-medium">No actors found</p>
            <p className="text-sm">Try a different search</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {items.map(actor => (
                <ActorCard key={actor.id} actor={actor} />
              ))}
            </div>

            {isFetchingNextPage && (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div ref={sentinelRef} className="h-1" />
          </>
        )}
      </div>
    </>
  )
}
