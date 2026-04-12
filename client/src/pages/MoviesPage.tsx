import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Plus, Search, Loader2 } from 'lucide-react'
import { mediaApi } from '@/lib/api'
import { MediaCard } from '@/components/MediaCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { hasMinRole } from '@/lib/types'

const NAVBAR_HEIGHT = 56 // px — matches h-14 in Navbar

function MediaCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border animate-pulse">
      <div className="aspect-[2/3] bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/3" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    </div>
  )
}

export function MoviesPage() {
  const { user } = useAuth()
  const isEditor = user ? hasMinRole(user.role, 'EDITOR') : false

  const [searchInput, setSearchInput] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

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
    queryKey: ['media', { limit: 24, q: committedSearch }],
    queryFn: ({ pageParam = 1 }) => mediaApi.list({
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
              placeholder="Search movies & shows…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm
                bg-input border border-border text-foreground
                placeholder:text-muted-foreground
                transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
            />
          </div>

          {/* Round add button */}
          {isEditor && (
            <Link to="/movies/new">
              <Button
                variant="default"
                size="round-icon"
                aria-label="Add Movie or Show"
                title="Add Movie/Show"
              >
                <Plus className="size-5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Page content — padded to clear navbar + sub-header */}
      <div
        className="container mx-auto px-4 py-6"
        style={{ paddingTop: SUB_HEADER_HEIGHT + 24 }}
      >
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {Array.from({ length: 24 }, (_, i) => (
              <MediaCardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm">Try a different search</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {items.map(item => (
                <MediaCard key={item.id} media={item} />
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
