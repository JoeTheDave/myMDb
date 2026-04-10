import { useState } from 'react'
import { toast } from 'sonner'
import { Clipboard, X, Loader2 } from 'lucide-react'
import { uploadApi } from '@/lib/api'

interface ImageUploaderProps {
  value?: string | undefined
  onChange: (url: string | undefined) => void
  label: string
  aspect?: string
}

export function ImageUploader({ value, onChange, label, aspect = 'aspect-[2/3]' }: ImageUploaderProps) {
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
      const file = new File([blob], 'clipboard-image.png', { type: 'image/png' })
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
    <div className="space-y-1">
      <p className="text-xs font-medium text-foreground leading-none select-none">{label}</p>

      <div
        className={`relative ${aspect} max-w-[160px] rounded-lg overflow-hidden border-2 border-dashed border-border bg-muted cursor-pointer hover:border-gold/60 transition-colors`}
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
