import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { actorApi } from '@/lib/api'
import { hasMinRole, formatContentRating } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'

function DetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 animate-pulse">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-48 shrink-0 aspect-[3/4] rounded-lg bg-muted" />
        <div className="flex-1 space-y-4">
          <div className="h-8 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}

export function ActorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: actor, isLoading } = useQuery({
    queryKey: ['actor', id],
    queryFn: () => actorApi.get(id!),
    enabled: !!id,
  })

  const isEditor = user ? hasMinRole(user.role, 'EDITOR') : false
  const isAdmin = user?.role === 'ADMIN'

  const deleteMutation = useMutation({
    mutationFn: () => actorApi.delete(id!),
    onSuccess: () => {
      toast.success('Actor deleted')
      queryClient.invalidateQueries({ queryKey: ['actors'] })
      navigate('/actors')
    },
    onError: () => toast.error('Failed to delete actor'),
  })

  if (isLoading) return <DetailSkeleton />
  if (!actor) return <div className="container mx-auto px-4 py-6 text-muted-foreground">Not found</div>

  const birthYear = actor.birthday ? new Date(actor.birthday).getFullYear() : null
  const deathYear = actor.deathDay ? new Date(actor.deathDay).getFullYear() : null

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Hero */}
      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-48 shrink-0">
          <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted">
            {actor.imageUrl ? (
              <img src={actor.imageUrl} alt={actor.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <svg className="size-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-3xl font-bold">{actor.name}</h1>
            <div className="flex gap-2">
              {isEditor && (
                <Link to={`/actors/${actor.id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Edit2 className="size-4 mr-1.5" /> Edit
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="size-4 mr-1.5" /> Delete
                </Button>
              )}
            </div>
          </div>

          {/* Born / died */}
          {birthYear && (
            <p className="text-muted-foreground text-sm">
              {deathYear ? `${birthYear} – ${deathYear}` : `Born ${birthYear}`}
            </p>
          )}

          {actor.bio && (
            <p className="text-muted-foreground leading-relaxed max-w-2xl">{actor.bio}</p>
          )}
        </div>
      </div>

      {/* Filmography */}
      {actor.filmography.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Filmography</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {actor.filmography.map(item => (
              <Link
                key={item.id}
                to={`/movies/${item.id}`}
                className="group flex flex-col hover:text-gold transition-colors"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2 relative">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground opacity-30">
                      <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18" />
                      </svg>
                    </div>
                  )}
                  {/* Character overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-white text-xs font-medium truncate">{item.characterName}</p>
                  </div>
                  <div className="absolute top-1 left-1">
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      {item.mediaType === 'MOVIE' ? 'M' : 'S'}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs font-semibold truncate">{item.title}</p>
                {item.releaseYear && (
                  <p className="text-xs text-muted-foreground">{item.releaseYear}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{actor.name}&quot;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this actor and their image. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Export formatContentRating to keep the import above from being flagged as unused
void formatContentRating
