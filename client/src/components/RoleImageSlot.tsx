import { useState, useRef, useEffect, useCallback } from 'react'
import { Clipboard, Loader2, Lightbulb, ExternalLink, Crosshair, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { uploadApi, imageApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { hasMinRole } from '@/lib/types'
import { ImageActionMenu } from '@/components/ImageActionMenu'
import { FocalPointEditor } from '@/components/FocalPointEditor'

const MAX_WIDTH = 600
const MAX_HEIGHT = 900

export async function resizeIfNeeded(blob: Blob): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1)
      if (ratio >= 1) { resolve(blob); return }
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.92)
    }
    img.src = url
  })
}

interface ImageSearchResult {
  thumbnailUrl: string
  fullUrl: string
}

interface ImageSearchModalProps {
  actorName: string
  characterName: string | null
  query?: string
  onSelect: (fullUrl: string) => void
  onClose: () => void
}

export function ImageSearchModal({ actorName, characterName, query: queryProp, onSelect, onClose }: ImageSearchModalProps) {
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<ImageSearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)

  const query = queryProp ?? (characterName ? `${actorName} ${characterName}` : actorName)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setHasMore(false)
    imageApi.searchImages(query, 1).then(data => {
      if (cancelled) return
      setResults(data.results)
      setHasMore(data.hasMore)
    }).catch(() => {
      if (cancelled) return
      setError('Failed to load image results.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [query])

  function handleLoadMore() {
    setLoadingMore(true)
    imageApi.searchImages(query, 11).then(data => {
      setResults(prev => [...prev, ...data.results])
      setHasMore(false)
    }).catch(() => {
      toast.error('Failed to load more results.')
    }).finally(() => {
      setLoadingMore(false)
    })
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === backdropRef.current) onClose()
  }

  function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
    const cell = (e.target as HTMLImageElement).closest<HTMLDivElement>('[data-image-cell]')
    if (cell) cell.style.display = 'none'
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h3 className="text-sm font-semibold">Image Search</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[28rem]">{query}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none ml-4"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {error}
            </div>
          ) : (
            <>
              {results.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  No results found.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {results.map((result, i) => (
                      <div
                        key={i}
                        data-image-cell
                        className="aspect-square overflow-hidden rounded-lg cursor-pointer group/img bg-muted relative"
                        onClick={() => onSelect(result.fullUrl)}
                      >
                        <img
                          src={result.thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-200 group-hover/img:scale-105"
                          onError={handleImageError}
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors duration-200" />
                      </div>
                    ))}
                  </div>
                  {hasMore && (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                      >
                        {loadingMore ? (
                          <><Loader2 className="size-3.5 animate-spin" /> Loading...</>
                        ) : (
                          'Load more'
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface RoleImageSlotProps {
  value?: string | undefined
  onChange: (url: string | null) => Promise<void>
  actorName: string
  characterName: string | null
  mediaTitle: string
  focalX?: number | null | undefined
  focalY?: number | null | undefined
  onFocalPointChange?: (x: number, y: number) => Promise<void>
}

export function RoleImageSlot({
  value,
  onChange,
  actorName,
  characterName,
  mediaTitle,
  focalX,
  focalY,
  onFocalPointChange,
}: RoleImageSlotProps) {
  const [uploading, setUploading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [focalEditorOpen, setFocalEditorOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const isEditor = user ? hasMinRole(user.role, 'EDITOR') : false

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const resized = await resizeIfNeeded(file)
      const uploadFile = new File([resized], 'image.jpg', { type: 'image/jpeg' })
      const { url } = await uploadApi.upload(uploadFile)
      await onChange(url)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handlePaste() {
    const isTouchDevice = window.matchMedia('(hover: none)').matches
    const canUseClipboard = !isTouchDevice && typeof navigator.clipboard?.read === 'function'

    if (!canUseClipboard) {
      fileInputRef.current?.click()
      return
    }

    void (async () => {
      try {
        const items = await navigator.clipboard.read()
        const imageItem = items.find(item => item.types.some(t => t.startsWith('image/')))
        if (!imageItem) { toast.error('No image found in clipboard'); return }
        const imageType = imageItem.types.find(t => t.startsWith('image/'))!
        const blob = await imageItem.getType(imageType)
        const resized = await resizeIfNeeded(blob)
        const file = new File([resized], 'clipboard-image.jpg', { type: 'image/jpeg' })
        setUploading(true)
        try {
          const { url } = await uploadApi.upload(file)
          await onChange(url)
        } catch {
          toast.error('Upload failed')
        } finally {
          setUploading(false)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          toast.error('Clipboard access denied')
        } else {
          toast.error('No image found in clipboard')
        }
      }
    })()
  }

  async function handleSearchSelect(fullUrl: string) {
    setSearchOpen(false)
    setUploading(true)
    try {
      const { imageUrl } = await imageApi.downloadImage(fullUrl)
      await onChange(imageUrl)
    } catch {
      toast.error('Failed to download image')
    } finally {
      setUploading(false)
    }
  }

  function openGoogleImages() {
    const q = [actorName, mediaTitle, characterName].filter(Boolean).join(' ')
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          'bg-muted cursor-pointer group/slot',
          !value && 'hover:bg-muted/80 transition-colors',
        )}
        onClick={focalEditorOpen ? undefined : handlePaste}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        {uploading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : value ? (
          <>
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition: `${focalX ?? 50}% ${focalY ?? 50}%` }}
            />
            {focalEditorOpen && (
              <FocalPointEditor
                imageSrc={value}
                initialX={focalX ?? 50}
                initialY={focalY ?? 50}
                onConfirm={(x, y) => {
                  void onFocalPointChange?.(x, y)
                  setFocalEditorOpen(false)
                }}
                onCancel={() => setFocalEditorOpen(false)}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/70">
            <Clipboard className="size-5 opacity-40" />
            <span className="text-[10px] leading-tight text-center px-1">Role Image</span>
          </div>
        )}

        {/* Speed dial menu — EDITOR+ only, hidden while focal editor is active */}
        {isEditor && !focalEditorOpen && (
          <ImageActionMenu
            triggerHoverClass="group-hover/slot:opacity-100"
            actions={[
              {
                icon: <ExternalLink className="size-3.5" />,
                label: 'Google Images',
                onClick: openGoogleImages,
              },
              {
                icon: <Lightbulb className="size-3.5" />,
                label: 'Search library',
                onClick: () => setSearchOpen(true),
              },
              ...(value ? [
                {
                  icon: <Crosshair className="size-3.5" />,
                  label: 'Set focal point',
                  onClick: () => setFocalEditorOpen(true),
                },
                {
                  icon: <Trash2 className="size-3.5" />,
                  label: 'Remove',
                  onClick: () => {
                    setUploading(true)
                    onChange(null).catch(() => {
                      toast.error('Failed to remove image')
                    }).finally(() => {
                      setUploading(false)
                    })
                  },
                  destructive: true,
                },
              ] : []),
            ]}
          />
        )}
      </div>

      {searchOpen && (
        <ImageSearchModal
          actorName={actorName}
          characterName={characterName}
          onSelect={url => { void handleSearchSelect(url) }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </>
  )
}
