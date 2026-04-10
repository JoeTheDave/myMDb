import { useState } from 'react'
import { toast } from 'sonner'
import { Clipboard, X, Loader2 } from 'lucide-react'
import { uploadApi } from '@/lib/api'

const MAX_WIDTH = 600
const MAX_HEIGHT = 900

async function resizeIfNeeded(blob: Blob): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1)
      if (ratio >= 1) {
        resolve(blob)
        return
      }
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

interface ImageUploaderProps {
  value?: string | undefined
  onChange: (url: string | undefined) => void
  label: string
  aspect?: string
  className?: string
  hideLabel?: boolean
}

export function ImageUploader({ value, onChange, label, aspect = 'aspect-[2/3]', className = 'max-w-[160px]', hideLabel = false }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)

  async function handlePaste() {
    if (typeof navigator.clipboard === 'undefined') {
      toast.error('Clipboard paste is not supported in this browser')
      return
    }
    try {
      const items = await navigator.clipboard.read()
      const imageItem = items.find(item => item.types.some(t => t.startsWith('image/')))
      if (!imageItem) {
        toast.error('No image found in clipboard')
        return
      }
      const imageType = imageItem.types.find(t => t.startsWith('image/'))!
      const blob = await imageItem.getType(imageType)
      const resized = await resizeIfNeeded(blob)
      const file = new File([resized], 'clipboard-image.jpg', { type: 'image/jpeg' })
      setUploading(true)
      try {
        const { url } = await uploadApi.upload(file)
        onChange(url)
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
  }

  return (
    <div className={hideLabel ? '' : 'space-y-1'}>
      {!hideLabel && <p className="text-xs font-medium text-foreground leading-none select-none">{label}</p>}

      <div
        className={`relative ${aspect} ${className} rounded-lg overflow-hidden border-2 border-dashed border-border bg-muted cursor-pointer hover:border-gold/60 transition-colors`}
        onClick={value ? undefined : handlePaste}
      >
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}
            {/* Replace on click */}
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/50 cursor-pointer"
              onClick={handlePaste}
            >
              <Clipboard className="size-6 text-white opacity-80" />
            </div>
            {/* Remove button */}
            <button
              type="button"
              className="absolute top-1 right-1 rounded-full bg-background/80 p-1 hover:bg-background transition-colors z-10"
              onClick={e => { e.stopPropagation(); onChange(undefined) }}
            >
              <X className="size-3" />
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
            {uploading ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <>
                <Clipboard className="size-6 opacity-50" />
                <span>Paste image</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
