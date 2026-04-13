import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { mediaApi } from '@/lib/api'
import { formatContentRating, hasMinRole } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { CastSection } from '@/components/CastSection'
import { AmazonPrimeSection } from '@/components/AmazonPrimeSection'
import { TrailerButton } from '@/components/TrailerButton'
import { RTRatingsSection } from '@/components/RTRatingsSection'

function DetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 animate-pulse">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-64 shrink-0 aspect-[2/3] rounded-lg bg-muted" />
        <div className="flex-1 space-y-4">
          <div className="h-8 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}

export function MediaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: media, isLoading } = useQuery({
    queryKey: ['media', id],
    queryFn: () => mediaApi.get(id!),
    enabled: !!id,
  })

  const isEditor = user ? hasMinRole(user.role, 'EDITOR') : false
  const isAdmin = user?.role === 'ADMIN'

  const deleteMutation = useMutation({
    mutationFn: () => mediaApi.delete(id!),
    onSuccess: () => {
      toast.success('Deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['media'] })
      navigate('/movies')
    },
    onError: () => toast.error('Failed to delete'),
  })

  if (isLoading) return <DetailSkeleton />
  if (!media) return <div className="container mx-auto px-4 py-6 text-muted-foreground">Not found</div>

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Hero */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Poster */}
        <div className="md:w-64 shrink-0">
          <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted">
            {media.imageUrl ? (
              <img src={media.imageUrl} alt={media.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <svg className="size-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold">{media.title}</h1>
            <div className="flex gap-2 shrink-0">
              {isEditor && (
                <Link to={`/movies/${media.id}/edit`}>
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

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {media.contentRating && (
              <Badge variant="outline">{formatContentRating(media.contentRating)}</Badge>
            )}
            {media.releaseYear && (
              <span className="text-sm text-muted-foreground">
                {media.releaseYear}
              </span>
            )}
          </div>

          {/* RT Ratings */}
          <RTRatingsSection
            mediaId={media.id}
            criticRating={media.criticRating}
            audienceRating={media.audienceRating}
            isEditor={isEditor}
          />

          {/* Amazon Prime Link */}
          <AmazonPrimeSection
            mediaId={media.id}
            amazonPrimeUrl={media.amazonPrimeUrl}
            isEditor={isEditor}
          />

          {/* Trailer */}
          <TrailerButton
            mediaId={media.id}
            trailerUrl={media.trailerUrl}
            isEditor={isEditor}
            title={media.title}
          />
        </div>
      </div>

      {/* Cast */}
      <section className="mt-10">
        <CastSection
          mediaId={media.id}
          mediaTitle={media.title}
          cast={media.cast}
          isEditor={isEditor}
          castSortOrder={media.castSortOrder}
        />
      </section>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{media.title}&quot;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this title and all its cast, ratings, and associated images. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
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
