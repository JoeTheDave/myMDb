import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { exploreApi, ApiError, type ExploreCandidate, type ExploreMediaType } from '@/lib/api'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 48
type ExplorePage = Awaited<ReturnType<typeof exploreApi.list>>

const TYPE_OPTIONS: Array<{ param: string | null; label: string; value: ExploreMediaType | undefined }> = [
  { param: null, label: 'All', value: undefined },
  { param: 'movies', label: 'Movies', value: 'MOVIE' },
  { param: 'shows', label: 'Shows', value: 'SHOW' },
]

function candidateKey(c: Pick<ExploreCandidate, 'tmdbId' | 'mediaType'>) {
  return `${c.mediaType}:${c.tmdbId}`
}

function ExploreCard({
  candidate,
  busy,
  onAdd,
  onDismiss,
}: {
  candidate: ExploreCandidate
  busy: boolean
  onAdd: () => void
  onDismiss: () => void
}) {
  const shown = candidate.actors.slice(0, 3)
  const extra = candidate.actors.length - shown.length

  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border flex flex-col">
      <div className="relative aspect-[2/3] bg-muted overflow-hidden">
        {candidate.posterUrl ? (
          <img src={candidate.posterUrl} alt={candidate.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
            {candidate.title}
          </div>
        )}
        {candidate.actors.length > 1 && (
          <span className="absolute top-2 left-2 rounded-full bg-black/70 text-white text-[11px] font-medium px-2 py-0.5">
            {candidate.actors.length} of your actors
          </span>
        )}
      </div>

      <div className="p-2.5 space-y-1.5 flex-1 flex flex-col">
        <h3 className="text-sm font-semibold leading-tight line-clamp-2" title={candidate.title}>
          {candidate.title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {candidate.releaseYear ?? '—'} · {candidate.mediaType === 'SHOW' ? 'Show' : 'Movie'}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-3 flex-1">
          {shown.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              <span className="text-foreground">{a.name}</span>
              {a.character && <span> ({a.character})</span>}
            </span>
          ))}
          {extra > 0 && <span> +{extra} more</span>}
        </p>

        <div className="flex justify-center gap-4 pt-1">
          <button
            type="button"
            aria-label={`Add ${candidate.title}`}
            title="Add to database"
            disabled={busy}
            onClick={onAdd}
            className="h-10 w-10 rounded-full flex items-center justify-center bg-green-600 text-white
              cursor-pointer hover:bg-green-700 transition-colors
              disabled:cursor-default disabled:opacity-50 disabled:hover:bg-green-600"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
          </button>
          <button
            type="button"
            aria-label={`Don't add ${candidate.title}`}
            title="Don't suggest again"
            disabled={busy}
            onClick={onDismiss}
            className="h-10 w-10 rounded-full flex items-center justify-center bg-red-600 text-white
              cursor-pointer hover:bg-red-700 transition-colors
              disabled:cursor-default disabled:opacity-50 disabled:hover:bg-red-600"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ExplorePage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set())
  const [searchParams, setSearchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const selectedType = TYPE_OPTIONS.find(o => o.param === typeParam) ?? TYPE_OPTIONS[0]!
  const actorId = searchParams.get('actor') ?? undefined

  function selectType(param: string | null) {
    const next = new URLSearchParams(searchParams)
    if (param) next.set('type', param)
    else next.delete('type')
    setSearchParams(next, { replace: true })
  }

  const filters = { type: selectedType.value, actorId }
  const { data, isLoading, isError, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['explore', filters],
    queryFn: ({ pageParam = 1 }) => exploreApi.list(pageParam as number, PAGE_SIZE, filters),
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    initialPageParam: 1,
  })

  const items = data?.pages.flatMap(p => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0
  const filterActor = data?.pages[0]?.actor ?? null

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  function setBusy(key: string, busy: boolean) {
    setBusyKeys(prev => {
      const next = new Set(prev)
      if (busy) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function removeFromList(key: string) {
    queryClient.setQueriesData<InfiniteData<ExplorePage>>({ queryKey: ['explore'] }, old =>
      old
        ? {
            ...old,
            pages: old.pages.map(p => ({ ...p, items: p.items.filter(i => candidateKey(i) !== key), total: p.total - 1 })),
          }
        : old,
    )
  }

  async function handleAdd(c: ExploreCandidate) {
    const key = candidateKey(c)
    setBusy(key, true)
    try {
      const media = await exploreApi.add(c)
      removeFromList(key)
      void queryClient.invalidateQueries({ queryKey: ['media'] })
      toast.success(`Added ${media.title}`, {
        action: { label: 'Open', onClick: () => navigate(`/movies/${media.id}`) },
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        removeFromList(key)
        toast.info(`${c.title} is already in the database`)
      } else {
        toast.error(err instanceof ApiError ? err.message : `Failed to add ${c.title}`)
      }
    } finally {
      setBusy(key, false)
    }
  }

  async function handleDismiss(c: ExploreCandidate) {
    const key = candidateKey(c)
    removeFromList(key)
    try {
      await exploreApi.dismiss(c)
    } catch {
      toast.error(`Couldn't dismiss ${c.title}`)
      void queryClient.invalidateQueries({ queryKey: ['explore'] })
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Explore</h1>
          <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Filter by type">
            {TYPE_OPTIONS.map(o => (
              <button
                key={o.label}
                type="button"
                aria-pressed={o === selectedType}
                onClick={() => selectType(o.param)}
                className={cn(
                  'h-7 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer',
                  o === selectedType ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {actorId && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 h-7 text-xs">
              With{' '}
              {filterActor ? (
                <Link to={`/actors/${filterActor.id}`} className="font-medium hover:text-gold">{filterActor.name}</Link>
              ) : (
                <span className="font-medium">…</span>
              )}
              <Link
                to={typeParam ? `/explore?type=${typeParam}` : '/explore'}
                aria-label="Show all actors"
                title="Show all actors"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </Link>
            </span>
          )}
        </div>
        {!isLoading && !isError && (
          <p className="text-sm text-muted-foreground">
            {total} title{total === 1 ? '' : 's'} featuring {filterActor ? filterActor.name : 'your actors'}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm">Scanning your actors' filmographies… the first load can take a little while.</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <p className="text-lg font-medium">Couldn't load suggestions</p>
          <p className="text-sm">Try refreshing the page</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <p className="text-lg font-medium">Nothing new to explore</p>
          <p className="text-sm">
            {actorId
              ? `Nothing found for ${filterActor?.name ?? 'this actor'}${selectedType.value ? ` in ${selectedType.label.toLowerCase()}` : ''}`
              : 'Add more movies to discover more of your actors\' work'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {items.map(c => (
              <ExploreCard
                key={candidateKey(c)}
                candidate={c}
                busy={busyKeys.has(candidateKey(c))}
                onAdd={() => void handleAdd(c)}
                onDismiss={() => void handleDismiss(c)}
              />
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
  )
}
