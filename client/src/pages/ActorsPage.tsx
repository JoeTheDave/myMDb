import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, ChevronLeft, ChevronRight, Search } from 'lucide-react'
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
  const isEditor = user ? hasMinRole(user.role, 'EDITOR') : false

  const [searchInput, setSearchInput] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 2-second debounce on search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setCommittedSearch(searchInput)
      setPage(1)
    }, 2000)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  const filters = {
    page,
    limit: 24,
    ...(committedSearch ? { q: committedSearch } : {}),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['actors', filters],
    queryFn: () => actorApi.list(filters),
  })

  const totalPages = data?.totalPages ?? 1
  const currentPage = page

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

          {/* Round add button */}
          {isEditor && (
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
              <ActorCardSkeleton key={i} />
            ))}
          </div>
        ) : data?.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <p className="text-lg font-medium">No actors found</p>
            <p className="text-sm">Try a different search</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {data?.items.map(actor => (
                <ActorCard key={actor.id} actor={actor} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2 tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
