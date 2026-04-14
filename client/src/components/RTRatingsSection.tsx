import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, RefreshCw, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { mediaApi, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { criticIcon, audienceIcon } from '@/lib/rtIcons'

interface RTRatingsSectionProps {
  mediaId: string
  criticRating: number | null
  audienceRating: number | null
  isEditor: boolean
  autoTrigger?: boolean
  onAutoTriggerDone?: () => void
}

export function RTRatingsSection({ mediaId, criticRating: initialCriticRating, audienceRating: initialAudienceRating, isEditor, autoTrigger, onAutoTriggerDone }: RTRatingsSectionProps) {
  const queryClient = useQueryClient()
  const [localCriticRating, setLocalCriticRating] = useState<number | null>(initialCriticRating)
  const [localAudienceRating, setLocalAudienceRating] = useState<number | null>(initialAudienceRating)
  const [isEditing, setIsEditing] = useState(false)
  const [editCritic, setEditCritic] = useState<string>('')
  const [editAudience, setEditAudience] = useState<string>('')
  const autoTriggeredRef = useRef(false)

  const hasRatings = localCriticRating !== null || localAudienceRating !== null

  const fetchRatingsMutation = useMutation({
    mutationFn: () => mediaApi.fetchRatings(mediaId),
    onSuccess: (data) => {
      setLocalCriticRating(data.criticRating)
      setLocalAudienceRating(data.audienceRating)
      queryClient.invalidateQueries({ queryKey: ['media', mediaId] })
      onAutoTriggerDone?.()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        toast.error('Could not find this title on Rotten Tomatoes.')
      } else {
        toast.error('Failed to fetch ratings')
      }
      onAutoTriggerDone?.()
    },
  })

  useEffect(() => {
    if (autoTrigger && !autoTriggeredRef.current && !fetchRatingsMutation.isPending) {
      autoTriggeredRef.current = true
      fetchRatingsMutation.mutate()
    }
  }, [autoTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateRatingsMutation = useMutation({
    mutationFn: (data: { criticRating?: number | null; audienceRating?: number | null }) =>
      mediaApi.updateRatings(mediaId, data),
    onSuccess: (data) => {
      setLocalCriticRating(data.criticRating)
      setLocalAudienceRating(data.audienceRating)
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['media', mediaId] })
    },
    onError: () => {
      toast.error('Failed to save ratings')
    },
  })

  function openEdit() {
    setEditCritic(localCriticRating !== null ? String(localCriticRating) : '')
    setEditAudience(localAudienceRating !== null ? String(localAudienceRating) : '')
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
  }

  function saveEdit() {
    const criticVal = editCritic.trim() === '' ? null : parseInt(editCritic, 10)
    const audienceVal = editAudience.trim() === '' ? null : parseInt(editAudience, 10)
    updateRatingsMutation.mutate({ criticRating: criticVal, audienceRating: audienceVal })
  }

  if (isEditing) {
    return (
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Tomatometer (0–100)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={editCritic}
            onChange={e => setEditCritic(e.target.value)}
            placeholder="—"
            className="w-24 px-2 py-1 text-sm rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Audience Score (0–100)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={editAudience}
            onChange={e => setEditAudience(e.target.value)}
            placeholder="—"
            className="w-24 px-2 py-1 text-sm rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1.5 pb-0.5">
          <button
            type="button"
            onClick={saveEdit}
            disabled={updateRatingsMutation.isPending}
            title="Save ratings"
            className="inline-flex items-center justify-center size-7 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {updateRatingsMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={updateRatingsMutation.isPending}
            title="Cancel"
            className="inline-flex items-center justify-center size-7 rounded border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    )
  }

  if (hasRatings) {
    return (
      <div className="flex gap-6 items-center">
        {localCriticRating !== null && (
          <div className="flex flex-col items-center gap-1">
            <img src={criticIcon(localCriticRating)} alt="Tomatometer" className="w-12 h-12" />
            <span className="text-xl font-bold">{localCriticRating}%</span>
            <span className="text-xs text-muted-foreground">Tomatometer</span>
          </div>
        )}
        {localAudienceRating !== null && (
          <div className="flex flex-col items-center gap-1">
            <img src={audienceIcon(localAudienceRating)} alt="Audience Score" className="w-12 h-12" />
            <span className="text-xl font-bold">{localAudienceRating}%</span>
            <span className="text-xs text-muted-foreground">Audience Score</span>
          </div>
        )}
        {isEditor && (
          <div className="flex gap-2 self-start mt-1">
            <button
              onClick={() => fetchRatingsMutation.mutate()}
              disabled={fetchRatingsMutation.isPending}
              title="Refresh ratings"
              className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30"
            >
              <RefreshCw className={`size-3.5 ${fetchRatingsMutation.isPending ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openEdit}
              title="Edit ratings manually"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  if (isEditor) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchRatingsMutation.mutate()}
          disabled={fetchRatingsMutation.isPending}
        >
          {fetchRatingsMutation.isPending ? (
            <>
              <Loader2 className="size-4 mr-1.5 animate-spin" /> Fetching...
            </>
          ) : (
            <>
              <img src="/rt-icons/fresh.svg" className="w-5 h-5 mr-1.5" alt="" /> Fetch Ratings
            </>
          )}
        </Button>
        <button
          onClick={openEdit}
          title="Enter ratings manually"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
    )
  }

  return null
}
