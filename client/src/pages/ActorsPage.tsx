import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { actorApi } from '@/lib/api'
import type { ActorListParams } from '@/lib/types'
import { hasMinRole } from '@/lib/types'
import { ActorCard } from '@/components/ActorCard'
import { ActorFilterBar } from '@/components/FilterBar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

function ActorCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden bg-card border border-border animate-pulse">
      <div className="aspect-[3/4] bg-muted" />
      <div className="p-2.5 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
    </div>
  )
}

export function ActorsPage() {
  const { user } = useAuth()
  const isEditor = user ? hasMinRole(user.role, 'EDITOR') : false

  const [filters, setFilters] = useState<ActorListParams>({ page: 1, limit: 24 })

  const { data, isLoading } = useQuery({
    queryKey: ['actors', filters],
    queryFn: () => actorApi.list(filters),
  })

  const totalPages = data?.totalPages ?? 1
  const currentPage = filters.page ?? 1

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Actors</h1>
        {isEditor && (
          <Link to="/actors/new">
            <Button size="sm" className="bg-gold text-black hover:bg-gold/90 font-semibold">
              <Plus className="size-4 mr-1" />
              Add Actor
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <aside className="md:w-56 shrink-0">
          <ActorFilterBar filters={filters} onFiltersChange={setFilters} />
        </aside>

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {Array.from({ length: 24 }, (_, i) => (
                <ActorCardSkeleton key={i} />
              ))}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <p className="text-lg">No actors found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {data?.items.map(actor => (
                  <ActorCard key={actor.id} actor={actor} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}

              {data && (
                <p className="text-center text-xs text-muted-foreground mt-3">
                  {data.total} total result{data.total !== 1 ? 's' : ''}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
