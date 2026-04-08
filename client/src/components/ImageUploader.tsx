import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Clipboard, X, Loader2, RefreshCw } from 'lucide-react'
import { uploadApi } from '@/lib/api'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface ImageUploaderProps {
  value?: string | undefined
  onChange: (url: string | undefined) => void
  label: string
  aspect?: string
}

export function ImageUploader({ value, onChange, label, aspect = 'aspect-[2/3]' }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const { url } = await uploadApi.upload(file)
      onChange(url)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

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
      const file = new File([blob], 'clipboard-image.png', { type: blob.type })
      await handleFile(file)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        toast.error('Clipboard access denied')
      } else {
        toast.error('No image found in clipboard')
      }
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value ? (
        <>
          <div
            className={`relative ${aspect} max-w-[160px] rounded-lg overflow-hidden border-2 border-dashed border-border bg-muted`}
          >
            <img src={value} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              className="absolute top-1 right-1 rounded-full bg-background/80 p-1 hover:bg-background"
              onClick={() => onChange(undefined)}
            >
              <X className="size-3" />
            </button>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Button type="button" variant="ghost" size="sm" onClick={handlePaste}>
              <RefreshCw className="size-3 mr-1" />
              Replace image
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => inputRef.current?.click()}
            >
              · or upload
            </button>
          </div>
        </>
      ) : (
        <>
          <div
            className={`relative ${aspect} max-w-[160px] rounded-lg overflow-hidden border-2 border-dashed border-border bg-muted cursor-pointer hover:border-gold/60 transition-colors`}
            onClick={handlePaste}
          >
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
              {uploading ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <>
                  <Clipboard className="size-6 opacity-50" />
                  <span>Click to paste image</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => inputRef.current?.click()}
          >
            or upload from file →
          </button>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
