import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Upload, X, Loader2 } from 'lucide-react'
import { actorApi, uploadApi } from '@/lib/api'
import type { ActorFormData } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface ImageUploaderProps {
  value?: string | undefined
  onChange: (url: string | undefined) => void
}

function ImageUploader({ value, onChange }: ImageUploaderProps) {
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

  return (
    <div className="space-y-1.5">
      <Label>Photo</Label>
      <div
        className="relative aspect-[3/4] max-w-[140px] rounded-lg overflow-hidden border-2 border-dashed border-border bg-muted cursor-pointer hover:border-gold/60 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              className="absolute top-1 right-1 rounded-full bg-background/80 p-1 hover:bg-background"
              onClick={e => {
                e.stopPropagation()
                onChange(undefined)
              }}
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
                <Upload className="size-6 opacity-50" />
                <span>Upload photo</span>
              </>
            )}
          </div>
        )}
      </div>
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

export function ActorFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = !!id

  const { data: existing, isLoading } = useQuery({
    queryKey: ['actor', id],
    queryFn: () => actorApi.get(id!),
    enabled: isEdit,
  })

  const [form, setForm] = useState<ActorFormData>({ name: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof ActorFormData, string>>>({})

  useEffect(() => {
    if (existing) {
      const next: ActorFormData = { name: existing.name }
      if (existing.imageUrl) next.imageUrl = existing.imageUrl
      if (existing.birthday) next.birthday = existing.birthday.slice(0, 10)
      if (existing.deathDay) next.deathDay = existing.deathDay.slice(0, 10)
      setForm(next)
    }
  }, [existing])

  const saveMutation = useMutation({
    mutationFn: (data: ActorFormData) =>
      isEdit ? actorApi.update(id!, data) : actorApi.create(data),
    onSuccess: result => {
      toast.success(isEdit ? 'Saved!' : 'Created!')
      queryClient.invalidateQueries({ queryKey: ['actors'] })
      queryClient.invalidateQueries({ queryKey: ['actor', id] })
      navigate(`/actors/${result.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function validate(): boolean {
    const e: Partial<Record<keyof ActorFormData, string>> = {}
    if (!form.name.trim()) e['name'] = 'Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    saveMutation.mutate(form)
  }

  if (isEdit && isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-10 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit' : 'Add'} Actor</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Actor name..."
          />
          {errors['name'] && <p className="text-xs text-destructive">{errors['name']}</p>}
        </div>

        {/* Photo */}
        <ImageUploader
          value={form.imageUrl}
          onChange={url => {
            setForm(f => {
              const next: ActorFormData = { ...f }
              if (url) {
                next.imageUrl = url
              } else {
                delete next.imageUrl
              }
              return next
            })
          }}
        />

        {/* Birthday */}
        <div className="space-y-1.5">
          <Label htmlFor="birthday">Birthday</Label>
          <Input
            id="birthday"
            type="date"
            value={form.birthday ?? ''}
            onChange={e => {
              const val = e.target.value
              setForm(f => {
                const next: ActorFormData = { ...f }
                if (val) {
                  next.birthday = val
                } else {
                  delete next.birthday
                }
                return next
              })
            }}
          />
        </div>

        {/* Death day */}
        <div className="space-y-1.5">
          <Label htmlFor="deathDay">Death Day (if applicable)</Label>
          <Input
            id="deathDay"
            type="date"
            value={form.deathDay ?? ''}
            onChange={e => {
              const val = e.target.value
              setForm(f => {
                const next: ActorFormData = { ...f }
                if (val) {
                  next.deathDay = val
                } else {
                  delete next.deathDay
                }
                return next
              })
            }}
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={saveMutation.isPending}
            className="bg-gold text-black hover:bg-gold/90 font-semibold"
          >
            {saveMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
