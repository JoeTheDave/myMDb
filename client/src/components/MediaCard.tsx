import { useNavigate } from 'react-router-dom'
import { formatContentRating } from '@/lib/types'
import type { MediaListItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { criticIcon, audienceIcon } from '@/lib/rtIcons'

interface MediaCardProps {
  media: MediaListItem
}

export function MediaCard({ media }: MediaCardProps) {
  const navigate = useNavigate()

  return (
    <div
      className={cn(
        'group cursor-pointer rounded-xl overflow-hidden',
        'bg-card border border-border',
        'hover:ring-2 hover:ring-gold/50 hover:scale-[1.02]',
        'transition-all duration-200',
      )}
      onClick={() => navigate(`/movies/${media.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/movies/${media.id}`)}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-muted overflow-hidden">
        {media.imageUrl ? (
          <img
            src={media.imageUrl}
            alt={media.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1.5">
        <h3 className="text-sm font-semibold truncate leading-tight" title={media.title}>
          {media.title}
        </h3>
        {media.releaseYear && (
          <p className="text-xs text-muted-foreground">{media.releaseYear}</p>
        )}
        {media.contentRating && (
          <p className="text-xs text-muted-foreground">{formatContentRating(media.contentRating)}</p>
        )}
        {(media.criticRating !== null || media.audienceRating !== null) && (
          <div className="flex gap-3 items-center pt-0.5">
            {media.criticRating !== null && (
              <div className="flex items-center gap-1">
                <img
                  src={criticIcon(media.criticRating)}
                  alt="Tomatometer"
                  className="w-4 h-4"
                />
                <span className="text-xs font-semibold">{media.criticRating}%</span>
              </div>
            )}
            {media.audienceRating !== null && (
              <div className="flex items-center gap-1">
                <img
                  src={audienceIcon(media.audienceRating)}
                  alt="Audience Score"
                  className="w-4 h-4"
                />
                <span className="text-xs font-semibold">{media.audienceRating}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
