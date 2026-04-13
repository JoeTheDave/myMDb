import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Clapperboard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { mediaApi, ApiError } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface TrailerButtonProps {
  mediaId: string
  trailerUrl: string | null
  isEditor: boolean
  title: string
}

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url)
    // youtube.com/watch?v=xxx
    const v = parsed.searchParams.get('v')
    if (v) return v
    // youtu.be/xxx
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.replace(/^\//, '')
    }
  } catch {
    // ignore
  }
  return null
}

export function TrailerButton({ mediaId, trailerUrl: initialTrailerUrl, isEditor, title }: TrailerButtonProps) {
  const [trailerUrl, setTrailerUrl] = useState<string | null>(initialTrailerUrl)
  const [modalOpen, setModalOpen] = useState(false)

  const lookupMutation = useMutation({
    mutationFn: () => mediaApi.lookupTrailer(mediaId),
    onSuccess: (result) => {
      setTrailerUrl(result.trailerUrl)
      setModalOpen(true)
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'Trailer lookup failed'
      toast.error(message)
    },
  })

  function handleClick() {
    if (trailerUrl) {
      setModalOpen(true)
    } else if (isEditor) {
      lookupMutation.mutate()
    } else {
      setModalOpen(true)
    }
  }

  const videoId = trailerUrl ? extractYouTubeId(trailerUrl) : null

  return (
    <>
      <button
        onClick={handleClick}
        disabled={lookupMutation.isPending}
        title="Watch trailer"
        className="inline-flex items-center justify-center size-14 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
      >
        {lookupMutation.isPending ? (
          <Loader2 className="size-7 animate-spin" />
        ) : (
          <Clapperboard className="size-7" />
        )}
      </button>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle>{title} — Trailer</DialogTitle>
          </DialogHeader>
          {videoId ? (
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full rounded-md"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
                title={`${title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              No trailer is available for this title.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
