import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { actorApi } from '@/lib/api'
import type { ActorFormData } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ImageUploader } from '@/components/ImageUploader'

// Attempts to parse free-form date text into YYYY-MM-DD.
// Returns null if unparseable.
function parseDateInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Already in YYYY-MM-DD — pass through to avoid UTC/local shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const d = new Date(trimmed)
  if (isNaN(d.getTime())) return null

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const [birthdayInput, setBirthdayInput] = useState('')
  const [deathDayInput, setDeathDayInput] = useState('')

  useEffect(() => {
    if (existing) {
      const next: ActorFormData = { name: existing.name }
      if (existing.imageUrl) next.imageUrl = existing.imageUrl
      const birthday = existing.birthday ? existing.birthday.slice(0, 10) : undefined
      const deathDay = existing.deathDay ? existing.deathDay.slice(0, 10) : undefined
      if (birthday) next.birthday = birthday
      if (deathDay) next.deathDay = deathDay
      setForm(next)
      setBirthdayInput(birthday ?? '')
      setDeathDayInput(deathDay ?? '')
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
        <div className="h-10 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-8">
          {/* Left column: form fields + actions */}
          <div className="flex-1 min-w-0 space-y-5">
            <h1 className="text-2xl font-bold">{isEdit ? 'Edit' : 'Add'} Actor</h1>

            {/* Name */}
            <div className="space-y-0.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={errors['name'] ? 'border-destructive focus-visible:ring-destructive/20' : ''}
              />
              {errors['name'] && <p className="text-xs text-destructive">{errors['name']}</p>}
            </div>

            {/* Birthday */}
            <div className="space-y-0.5">
              <Label htmlFor="birthday">Birth</Label>
              <Input
                id="birthday"
                value={birthdayInput}
                onChange={e => setBirthdayInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseDateInput(birthdayInput)
                  setBirthdayInput(parsed ?? '')
                  setForm(f => {
                    const next: ActorFormData = { ...f }
                    if (parsed) { next.birthday = parsed } else { delete next.birthday }
                    return next
                  })
                }}
              />
            </div>

            {/* Death day */}
            <div className="space-y-0.5">
              <Label htmlFor="deathDay">Death</Label>
              <Input
                id="deathDay"
                value={deathDayInput}
                onChange={e => setDeathDayInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseDateInput(deathDayInput)
                  setDeathDayInput(parsed ?? '')
                  setForm(f => {
                    const next: ActorFormData = { ...f }
                    if (parsed) { next.deathDay = parsed } else { delete next.deathDay }
                    return next
                  })
                }}
              />
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

          {/* Right column: photo */}
          <div className="w-72 shrink-0">
            <ImageUploader
              label="Photo"
              aspect="aspect-[3/4]"
              className="w-full"
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
          </div>
        </div>
      </form>
    </div>
  )
}
