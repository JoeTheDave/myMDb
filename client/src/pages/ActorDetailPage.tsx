import { useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit2, Trash2, User, Film } from 'lucide-react'
import { toast } from 'sonner'
import { actorApi, castApi } from '@/lib/api'
import { hasMinRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { RoleImageSlot } from '@/components/RoleImageSlot'
import type { ActorFilmographyItem } from '@/lib/types'

function formatUTCDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

function calcAge(birthday: string | Date, asOf?: string | Date): number {
  const birth = new Date(birthday)
  const ref = asOf ? new Date(asOf) : new Date()
  let age = ref.getUTCFullYear() - birth.getUTCFullYear()
  const monthDiff = ref.getUTCMonth() - birth.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < birth.getUTCDate())) age--
  return age
}

interface FilmographyCardProps {
  item: ActorFilmographyItem
  isEditor: boolean
  actorId: string
  actorName: string
  onUpdated: (mediaId: string) => void
}

function FilmographyCard({ item, isEditor, actorName, onUpdated }: FilmographyCardProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const committingRef = useRef(false)

  function startEditing() {
    setNameValue(item.characterName ?? '')
    setEditingName(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function commitName() {
    if (committingRef.current) return
    committingRef.current = true
    const trimmed = nameValue.trim()
    setEditingName(false)
    if (!trimmed || trimmed === (item.characterName ?? '')) {
      committingRef.current = false
      return
    }
    setSaving(true)
    try {
      await castApi.update(item.castRoleId, { characterName: trimmed })
      onUpdated(item.id)
    } catch {
      toast.error('Failed to save role name')
    } finally {
      setSaving(false)
      committingRef.current = false
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commitName()
    } else if (e.key === 'Escape') {
      setEditingName(false)
    }
  }

  async function handleRoleImageChange(url: string | undefined) {
    await castApi.update(item.castRoleId, { roleImageUrl: url ?? undefined })
    onUpdated(item.id)
  }

  async function handleFocalPointChange(x: number, y: number) {
    await castApi.update(item.castRoleId, { roleImageFocalX: x, roleImageFocalY: y })
    onUpdated(item.id)
  }

  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border flex flex-col group/card">
      {/* Split image */}
      <div className="flex aspect-square">
        {/* Left: movie poster — clicking navigates to movie */}
        <Link
          to={`/movies/${item.id}`}
          className="flex-1 relative overflow-hidden bg-muted block"
          tabIndex={0}
        >
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover group-hover/card:scale-[1.02] transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Film className="size-8 opacity-30" />
            </div>
          )}
        </Link>

        {/* Divider */}
        <div className="w-px bg-border shrink-0" />

        {/* Right: role image */}
        <div className="flex-1 relative overflow-hidden">
          {isEditor ? (
            <RoleImageSlot
              value={item.roleImageUrl}
              onChange={handleRoleImageChange}
              actorName={actorName}
              characterName={item.characterName}
              mediaTitle={item.title}
              focalX={item.roleImageFocalX}
              focalY={item.roleImageFocalY}
              onFocalPointChange={handleFocalPointChange}
            />
          ) : item.roleImageUrl ? (
            <img
              src={item.roleImageUrl}
              alt={`${item.characterName ?? ''} in ${item.title}`}
              className="w-full h-full object-cover"
              style={{ objectPosition: `${item.roleImageFocalX ?? 50}% ${item.roleImageFocalY ?? 50}%` }}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full absolute inset-0 flex items-center justify-center text-muted-foreground bg-muted">
              <User className="size-8 opacity-30" />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-2 py-2.5 text-center space-y-0.5">
        <Link
          to={`/movies/${item.id}`}
          className="text-sm font-semibold block truncate hover:text-gold transition-colors leading-tight"
          title={item.title}
        >
          {item.title}
        </Link>

        {/* Character name */}
        {editingName ? (
          <input
            ref={inputRef}
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => void commitName()}
            disabled={saving}
            className={cn(
              'w-full text-xs text-center bg-transparent border-b border-gold/60',
              'outline-none text-foreground disabled:opacity-50 pb-0.5',
            )}
          />
        ) : item.characterName ? (
          <p
            className={cn(
              'text-xs text-muted-foreground truncate',
              isEditor && 'cursor-pointer hover:text-foreground transition-colors',
              saving && 'opacity-50',
            )}
            title={isEditor ? 'Click to edit' : item.characterName}
            onClick={isEditor ? startEditing : undefined}
          >
            {item.characterName}
          </p>
        ) : isEditor ? (
          <button
            type="button"
            onClick={startEditing}
            className="text-xs italic text-zinc-500 hover:text-zinc-400 transition-colors block w-full"
          >
            role
          </button>
        ) : (
          <p className="text-xs text-muted-foreground/40">&nbsp;</p>
        )}

        {item.releaseYear ? (
          <p className="text-xs text-muted-foreground/70">{item.releaseYear}</p>
        ) : (
          <p className="text-xs text-muted-foreground/70">&nbsp;</p>
        )}
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 animate-pulse">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-48 shrink-0 aspect-[3/4] rounded-lg bg-muted" />
        <div className="flex-1 space-y-4">
          <div className="h-8 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}

export function ActorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: actor, isLoading } = useQuery({
    queryKey: ['actor', id],
    queryFn: () => actorApi.get(id!),
    enabled: !!id,
  })

  const isEditor = user ? hasMinRole(user.role, 'EDITOR') : false
  const isAdmin = user?.role === 'ADMIN'

  const deleteMutation = useMutation({
    mutationFn: () => actorApi.delete(id!),
    onSuccess: () => {
      toast.success('Actor deleted')
      queryClient.invalidateQueries({ queryKey: ['actors'] })
      navigate('/actors')
    },
    onError: () => toast.error('Failed to delete actor'),
  })

  function handleFilmographyUpdated(mediaId: string) {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['actor', id] }),
      queryClient.invalidateQueries({ queryKey: ['media', mediaId] }),
    ])
  }

  if (isLoading) return <DetailSkeleton />
  if (!actor) return <div className="container mx-auto px-4 py-6 text-muted-foreground">Not found</div>

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Hero */}
      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-48 shrink-0">
          <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted">
            {actor.imageUrl ? (
              <img
                src={actor.imageUrl}
                alt={actor.name}
                className="w-full h-full object-cover"
                style={{ objectPosition: `${actor.imageFocalX ?? 50}% ${actor.imageFocalY ?? 50}%` }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <svg className="size-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold">{actor.name}</h1>
            <div className="flex gap-2 shrink-0">
              {isEditor && (
                <Link to={`/actors/${actor.id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Edit2 className="size-4 mr-1.5" /> Edit
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="size-4 mr-1.5" /> Delete
                </Button>
              )}
            </div>
          </div>

          {/* Born / died / age */}
          {actor.birthday && (
            <div className="text-muted-foreground text-sm space-y-0.5">
              <p>Born: {formatUTCDate(actor.birthday)}</p>
              {actor.deathDay && (
                <p>Died: {formatUTCDate(actor.deathDay)}</p>
              )}
              {actor.deathDay ? (
                <p>Age at death: {calcAge(actor.birthday, actor.deathDay)}</p>
              ) : (
                <p>Age: {calcAge(actor.birthday)}</p>
              )}
            </div>
          )}

          {actor.bio && (
            <p className="text-muted-foreground leading-relaxed max-w-2xl">{actor.bio}</p>
          )}
        </div>
      </div>

      {/* Filmography */}
      {actor.filmography.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Filmography</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {actor.filmography.map(item => (
              <FilmographyCard
                key={item.castRoleId}
                item={item}
                isEditor={isEditor}
                actorId={actor.id}
                actorName={actor.name}
                onUpdated={handleFilmographyUpdated}
              />
            ))}
          </div>
        </section>
      )}

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{actor.name}&quot;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this actor and their image. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
