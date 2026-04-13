import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { ActorListItem } from '@/lib/types'

interface ActorCardProps {
  actor: ActorListItem
}

export function ActorCard({ actor }: ActorCardProps) {
  const navigate = useNavigate()

  const birthYear = actor.birthday ? new Date(actor.birthday).getFullYear() : null
  const deathYear = actor.deathDay ? new Date(actor.deathDay).getFullYear() : null

  return (
    <div
      className={cn(
        'group cursor-pointer rounded-xl overflow-hidden',
        'bg-card border border-border',
        'hover:ring-2 hover:ring-gold/50 hover:scale-[1.02]',
        'transition-all duration-200',
      )}
      onClick={() => navigate(`/actors/${actor.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/actors/${actor.id}`)}
    >
      {/* Photo */}
      <div className="relative aspect-[3/4] bg-muted overflow-hidden">
        {actor.imageUrl ? (
          <img
            src={actor.imageUrl}
            alt={actor.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={{ objectPosition: `${actor.imageFocalX ?? 50}% ${actor.imageFocalY ?? 50}%` }}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
            <svg
              className="size-12 opacity-30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-0.5">
        <h3 className="text-sm font-semibold truncate leading-tight" title={actor.name}>
          {actor.name}
        </h3>
        {birthYear && (
          <p className="text-xs text-muted-foreground">
            {birthYear}
            {deathYear ? ` – ${deathYear}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
