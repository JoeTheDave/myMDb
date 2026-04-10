import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, Loader2, Trash2, Plus } from 'lucide-react'
import { mediaApi, actorApi, castApi } from '@/lib/api'
import type { MediaFormData, CastRoleFormData, ContentRating, MediaType, ActorListItem } from '@/lib/types'
import { MOVIE_RATINGS, TV_RATINGS, formatContentRating } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectItem } from '@/components/ui/select'
import { ImageUploader } from '@/components/ImageUploader'

// Actor search autocomplete
function ActorSearch({ onSelect }: { onSelect: (actor: ActorListItem) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['actors-search', q],
    queryFn: () => actorApi.list({ q, limit: 10 }),
    enabled: q.length >= 1,
  })

  return (
    <div className="relative">
      <Input
        placeholder="Search actor..."
        value={q}
        onChange={e => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && data && data.items.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-y-auto">
          {data.items.map(actor => (
            <button
              key={actor.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 transition-colors"
              onMouseDown={() => {
                onSelect(actor)
                setQ('')
                setOpen(false)
              }}
            >
              {actor.imageUrl && (
                <img src={actor.imageUrl} alt={actor.name} className="size-6 rounded-full object-cover" />
              )}
              {actor.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface CastFormState {
  actor: ActorListItem | null
  characterName: string
  roleImageUrl?: string | undefined
}

export function MediaFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = !!id

  const { data: existing, isLoading } = useQuery({
    queryKey: ['media', id],
    queryFn: () => mediaApi.get(id!),
    enabled: isEdit,
  })

  const [form, setForm] = useState<MediaFormData>({
    title: '',
    mediaType: 'MOVIE',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof MediaFormData, string>>>({})
  const [castForm, setCastForm] = useState<CastFormState>({ actor: null, characterName: '' })
  const [addingCast, setAddingCast] = useState(false)

  useEffect(() => {
    if (existing) {
      const next: MediaFormData = {
        title: existing.title,
        mediaType: existing.mediaType,
      }
      if (existing.imageUrl) next.imageUrl = existing.imageUrl
      if (existing.releaseYear) next.releaseYear = existing.releaseYear
      if (existing.contentRating) next.contentRating = existing.contentRating
      setForm(next)
    }
  }, [existing])

  const saveMutation = useMutation({
    mutationFn: (data: MediaFormData) =>
      isEdit ? mediaApi.update(id!, data) : mediaApi.create(data),
    onSuccess: result => {
      toast.success(isEdit ? 'Saved!' : 'Created!')
      queryClient.invalidateQueries({ queryKey: ['media'] })
      navigate(`/movies/${result.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteCastMutation = useMutation({
    mutationFn: (castId: string) => castApi.delete(castId),
    onSuccess: () => {
      toast.success('Cast member removed')
      queryClient.invalidateQueries({ queryKey: ['media', id] })
    },
    onError: () => toast.error('Failed to remove cast member'),
  })

  const addCastMutation = useMutation({
    mutationFn: (data: CastRoleFormData) => castApi.add(id!, data),
    onSuccess: () => {
      toast.success('Cast member added')
      setCastForm({ actor: null, characterName: '' })
      setAddingCast(false)
      queryClient.invalidateQueries({ queryKey: ['media', id] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const ratingOptions = form.mediaType === 'MOVIE' ? MOVIE_RATINGS : TV_RATINGS

  function validate(): boolean {
    const e: Partial<Record<keyof MediaFormData, string>> = {}
    if (!form.title.trim()) e['title'] = 'Title is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    const validRatings = ratingOptions as readonly ContentRating[]
    const contentRating =
      form.contentRating && validRatings.includes(form.contentRating) ? form.contentRating : undefined
    const data: MediaFormData = { ...form }
    if (contentRating) {
      data.contentRating = contentRating
    } else {
      delete data.contentRating
    }
    saveMutation.mutate(data)
  }

  function handleTypeChange(type: MediaType) {
    setForm(f => {
      const next: MediaFormData = { ...f, mediaType: type }
      delete next.contentRating
      return next
    })
  }

  function handleAddCast() {
    if (!castForm.actor || !castForm.characterName.trim()) {
      toast.error('Select an actor and enter a character name')
      return
    }
    const data: CastRoleFormData = {
      actorId: castForm.actor.id,
      characterName: castForm.characterName,
    }
    if (castForm.roleImageUrl) data.roleImageUrl = castForm.roleImageUrl
    addCastMutation.mutate(data)
  }

  if (isEdit && isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit' : 'Add'} Movie</h1>

      <form onSubmit={handleSubmit}>
        <div className="flex gap-8">
          {/* Left column: all form fields + actions */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Title */}
            <div className="space-y-1">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Enter title..."
                className={errors['title'] ? 'border-destructive focus-visible:ring-destructive/20' : ''}
              />
              {errors['title'] && <p className="text-xs text-destructive">{errors['title']}</p>}
            </div>

            {/* Type */}
            <div className="space-y-1">
              <Label>Type</Label>
              <div className="flex gap-2">
                {(['MOVIE', 'SHOW'] as const).map(t => (
                  <Button
                    key={t}
                    type="button"
                    variant={form.mediaType === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTypeChange(t)}
                    className={form.mediaType === t ? 'bg-gold text-black hover:bg-gold/90' : ''}
                  >
                    {t === 'MOVIE' ? 'Movie' : 'Show'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Release year */}
            <div className="space-y-1">
              <Label htmlFor="releaseYear">Release Year</Label>
              <Input
                id="releaseYear"
                type="number"
                min={1888}
                max={2100}
                placeholder="e.g. 2024"
                value={form.releaseYear ?? ''}
                onChange={e => {
                  const val = e.target.value
                  setForm(f => {
                    const next: MediaFormData = { ...f }
                    if (val) {
                      next.releaseYear = parseInt(val, 10)
                    } else {
                      delete next.releaseYear
                    }
                    return next
                  })
                }}
              />
            </div>

            {/* Content rating */}
            <div className="space-y-1">
              <Label>Content Rating</Label>
              <Select
                key={form.mediaType}
                value={form.contentRating ?? ''}
                onValueChange={v => {
                  setForm(f => {
                    const next: MediaFormData = { ...f }
                    if (v) {
                      next.contentRating = v as ContentRating
                    } else {
                      delete next.contentRating
                    }
                    return next
                  })
                }}
                placeholder="Select rating…"
                className="w-48"
              >
                {ratingOptions.map(r => (
                  <SelectItem key={r} value={r}>
                    {formatContentRating(r)}
                  </SelectItem>
                ))}
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-gold text-black hover:bg-gold/90 font-semibold"
              >
                {saveMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </div>

          {/* Right column: Poster image */}
          <div className="w-48 shrink-0">
            <ImageUploader
              label="Poster"
              aspect="aspect-[2/3]"
              className="w-full"
              value={form.imageUrl}
              onChange={url => {
                setForm(f => {
                  const next: MediaFormData = { ...f }
                  if (url) {
                    next.imageUrl = url
                  } else {
                    delete next.imageUrl
                  }
                  return next
                })
              }}
            />
          </div>
        </div>
      </form>

      {/* Cast section (edit mode only) */}
      {isEdit && existing && (
        <section className="mt-10 border-t border-border pt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Cast</h2>
            <Button variant="outline" size="sm" onClick={() => setAddingCast(!addingCast)}>
              <Plus className="size-4 mr-1" />
              Add Cast
            </Button>
          </div>

          {/* Add cast form */}
          {addingCast && (
            <div className="rounded-lg border border-border bg-card p-4 mb-4 space-y-3">
              <div className="space-y-1">
                <Label>Actor</Label>
                <ActorSearch onSelect={actor => setCastForm(f => ({ ...f, actor }))} />
                {castForm.actor && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{castForm.actor.name}</Badge>
                    <button type="button" onClick={() => setCastForm(f => ({ ...f, actor: null }))}>
                      <X className="size-3 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label>Character Name</Label>
                <Input
                  placeholder="Character name..."
                  value={castForm.characterName}
                  onChange={e => setCastForm(f => ({ ...f, characterName: e.target.value }))}
                />
              </div>
              <ImageUploader
                label="Role Image (optional)"
                value={castForm.roleImageUrl}
                onChange={url => {
                  setCastForm(f => {
                    const next: CastFormState = { ...f }
                    if (url) {
                      next.roleImageUrl = url
                    } else {
                      delete next.roleImageUrl
                    }
                    return next
                  })
                }}
                aspect="aspect-[3/4]"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCast}
                  disabled={addCastMutation.isPending}
                  className="bg-gold text-black hover:bg-gold/90"
                >
                  {addCastMutation.isPending && <Loader2 className="size-3 mr-1.5 animate-spin" />}
                  Add
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingCast(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Cast list */}
          {existing.cast.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cast members yet.</p>
          ) : (
            <div className="space-y-2">
              {existing.cast.map(member => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  <div className="size-10 rounded overflow-hidden bg-muted shrink-0">
                    {(member.roleImageUrl ?? member.actor.imageUrl) && (
                      <img
                        src={member.roleImageUrl ?? member.actor.imageUrl}
                        alt={member.characterName}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.characterName}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.actor.name}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteCastMutation.mutate(member.id)}
                    disabled={deleteCastMutation.isPending}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
