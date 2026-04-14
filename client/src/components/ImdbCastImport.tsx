import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { mediaApi, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ImdbCastImportProps {
  mediaId: string
  autoTriggerImdbId?: string | null | undefined
  onAutoTriggerDone?: (() => void) | undefined
}

export function ImdbCastImport({ mediaId, autoTriggerImdbId, onAutoTriggerDone }: ImdbCastImportProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [imdbId, setImdbId] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoTriggeredRef = useRef(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    return () => {
      if (blurTimerRef.current !== null) {
        clearTimeout(blurTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isExpanded) {
      inputRef.current?.focus()
    }
  }, [isExpanded])

  const importMutation = useMutation({
    mutationFn: (id: string) => mediaApi.importCast(mediaId, id),
    onSuccess: (result) => {
      toast.success(`Cast imported: ${result.imported} imported, ${result.created} created, ${result.matched} matched, ${result.skipped} skipped`)
      void queryClient.invalidateQueries({ queryKey: ['media', mediaId] })
      setIsExpanded(false)
      setImdbId('')
      setValidationError(null)
      onAutoTriggerDone?.()
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'Failed to import cast'
      toast.error(message)
      onAutoTriggerDone?.()
    },
  })

  useEffect(() => {
    if (autoTriggerImdbId && !autoTriggeredRef.current && !importMutation.isPending) {
      autoTriggeredRef.current = true
      importMutation.mutate(autoTriggerImdbId)
    }
  }, [autoTriggerImdbId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit() {
    const trimmed = imdbId.trim()
    if (!/^tt\d+$/.test(trimmed)) {
      setValidationError('Invalid format. Expected: tt1234567')
      return
    }
    setValidationError(null)
    importMutation.mutate(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setIsExpanded(false)
      setImdbId('')
      setValidationError(null)
    }
  }

  function handleBlur() {
    // Small delay so clicking the button doesn't collapse before it registers
    blurTimerRef.current = setTimeout(() => {
      if (!importMutation.isPending) {
        setIsExpanded(false)
        setImdbId('')
        setValidationError(null)
      }
    }, 150)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {!isExpanded ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded(true)}
        >
          <span
            className="inline-block bg-[#F5C518] text-black text-[10px] font-bold px-1 rounded mr-1.5 leading-tight py-0.5"
          >
            IMDb
          </span>
          Load from IMDb
        </Button>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={imdbId}
              onChange={(e) => {
                setImdbId(e.target.value)
                setValidationError(null)
              }}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="IMDB title ID (e.g. tt1234567)"
              className="h-7 text-xs w-52"
              disabled={importMutation.isPending}
            />
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleSubmit}
              disabled={importMutation.isPending}
              onMouseDown={(e) => e.preventDefault()}
            >
              {importMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                'Import'
              )}
            </Button>
          </div>
          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
        </div>
      )}
    </div>
  )
}
