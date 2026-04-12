import { useState } from 'react'
import { Clipboard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { uploadApi } from '@/lib/api'

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

interface RoleImageSlotProps {
  value?: string | undefined
  onChange: (url: string | undefined) => Promise<void>
}

export function RoleImageSlot({ value, onChange }: RoleImageSlotProps) {
  const [uploading, setUploading] = useState(false)

  async function handlePaste() {
    if (typeof navigator.clipboard === 'undefined') {
      toast.error('Clipboard paste is not supported in this browser')
      return
    }
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
  }

  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center',
        'bg-muted cursor-pointer group/slot',
        !value && 'hover:bg-muted/80 transition-colors',
      )}
      onClick={value ? undefined : handlePaste}
    >
      {uploading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : value ? (
        <>
          <img src={value} alt="" className="w-full h-full object-cover object-top" />
          {/* Hover overlay to replace */}
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity bg-black/50 cursor-pointer"
            onClick={handlePaste}
          >
            <Clipboard className="size-5 text-white opacity-80" />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
          <Clipboard className="size-5 opacity-60" />
          <span className="text-[10px] leading-tight text-center px-1">Role Image</span>
        </div>
      )}
    </div>
  )
}
