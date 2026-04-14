import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Lightbulb, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { mediaApi, ApiError } from '@/lib/api'

interface AmazonPrimeSectionProps {
  mediaId: string
  amazonPrimeUrl: string | null
  isEditor: boolean
  autoTrigger?: boolean
  onAutoTriggerDone?: () => void
}

export function AmazonPrimeSection({ mediaId, amazonPrimeUrl, isEditor, autoTrigger, onAutoTriggerDone }: AmazonPrimeSectionProps) {
  const [localUrl, setLocalUrl] = useState<string | null>(amazonPrimeUrl)
  const [inputValue, setInputValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const queryClient = useQueryClient()
  const autoTriggeredRef = useRef(false)

  const updateMutation = useMutation({
    mutationFn: (url: string | null) => mediaApi.updateAmazonPrimeUrl(mediaId, url),
    onSuccess: (result) => {
      setLocalUrl(result.amazonPrimeUrl)
      setIsEditing(false)
      void queryClient.invalidateQueries({ queryKey: ['media', mediaId] })
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'Failed to update Amazon Prime URL'
      toast.error(message)
    },
  })

  const lookupMutation = useMutation({
    mutationFn: () => mediaApi.lookupAmazonPrime(mediaId),
    onSuccess: (result) => {
      if (result.amazonPrimeUrl) {
        setLocalUrl(result.amazonPrimeUrl)
        setIsEditing(false)
        void queryClient.invalidateQueries({ queryKey: ['media', mediaId] })
      } else {
        toast.info('No Amazon Prime listing found for this title.')
      }
      onAutoTriggerDone?.()
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'Amazon lookup failed'
      toast.error(message)
      onAutoTriggerDone?.()
    },
  })

  useEffect(() => {
    if (autoTrigger && !autoTriggeredRef.current && !lookupMutation.isPending) {
      autoTriggeredRef.current = true
      lookupMutation.mutate()
    }
  }, [autoTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleInputCommit() {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    updateMutation.mutate(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleInputCommit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setInputValue('')
    }
  }

  function handleEditClick() {
    setInputValue(localUrl ?? '')
    setIsEditing(true)
  }

  // Link display mode (URL set, not editing)
  if (localUrl && !isEditing) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={localUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ExternalLink className="size-3.5" />
          Watch on Amazon Prime
        </a>
        {isEditor && (
          <>
            <button
              onClick={() => lookupMutation.mutate()}
              disabled={lookupMutation.isPending}
              title="Re-run Amazon Prime lookup"
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {lookupMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Lightbulb className="size-3.5" />
              )}
            </button>
            <button
              onClick={handleEditClick}
              title="Edit Amazon Prime link"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="size-3.5" />
            </button>
          </>
        )}
      </div>
    )
  }

  if (!isEditor) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  // Input mode (URL null, or editor clicked pencil)
  return (
    <div className="flex items-center gap-2">
      <input
        type="url"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleInputCommit}
        onKeyDown={handleKeyDown}
        placeholder="Amazon Prime movie link"
        className="h-7 text-xs rounded-md border border-input bg-transparent px-2 py-1 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-56 disabled:opacity-50"
        disabled={updateMutation.isPending}
        autoFocus={isEditing}
      />
      <button
        onClick={() => lookupMutation.mutate()}
        disabled={lookupMutation.isPending}
        title="Look up Amazon Prime listing"
        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
      >
        {lookupMutation.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Lightbulb className="size-3.5" />
        )}
      </button>
    </div>
  )
}
