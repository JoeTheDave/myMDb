import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  userRating: number | null
  communityAvg: number | null
  communityCount: number
  onRate?: (stars: number) => void
  readonly?: boolean
  size?: 'sm' | 'md'
}

export function StarRating({
  userRating,
  communityAvg,
  communityCount,
  onRate,
  readonly = false,
  size = 'md',
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const starSize = size === 'sm' ? 'size-4' : 'size-5'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  // Determine display fill level
  const previewRating = hovered ?? userRating
  const displayAvg = communityAvg

  function getStarFill(starIndex: number): 'gold' | 'partial' | 'empty' {
    const n = starIndex + 1

    if (!readonly && previewRating !== null) {
      return n <= previewRating ? 'gold' : 'empty'
    }

    if (userRating !== null) {
      return n <= userRating ? 'gold' : 'empty'
    }

    if (displayAvg !== null) {
      if (n <= Math.floor(displayAvg)) return 'partial'
      if (n === Math.ceil(displayAvg) && displayAvg % 1 >= 0.5) return 'partial'
      return 'empty'
    }

    return 'empty'
  }

  const showCommunityInfo =
    communityAvg !== null &&
    communityCount > 0 &&
    (userRating === null || Math.abs(communityAvg - userRating) >= 0.2)

  return (
    <div className="flex items-center gap-1.5">
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => !readonly && setHovered(null)}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const fill = getStarFill(i)
          return (
            <button
              key={i}
              type="button"
              disabled={readonly}
              onClick={() => !readonly && onRate?.(i + 1)}
              onMouseEnter={() => !readonly && setHovered(i + 1)}
              className={cn(
                'transition-transform',
                !readonly && 'cursor-pointer hover:scale-110',
                readonly && 'cursor-default',
              )}
              aria-label={`Rate ${i + 1} star${i === 0 ? '' : 's'}`}
            >
              <Star
                className={cn(
                  starSize,
                  'transition-colors',
                  fill === 'gold' && 'fill-gold stroke-gold',
                  fill === 'partial' && 'fill-gold/50 stroke-gold/70',
                  fill === 'empty' && 'fill-transparent stroke-muted-foreground',
                )}
              />
            </button>
          )
        })}
      </div>

      {userRating !== null && (
        <span className={cn(textSize, 'font-semibold text-gold')}>{userRating}</span>
      )}

      {showCommunityInfo && (
        <span className={cn(textSize, 'text-muted-foreground')}>
          {userRating !== null && '('}
          {displayAvg?.toFixed(1)}
          <span className="ml-0.5 text-xs">({communityCount})</span>
          {userRating !== null && ')'}
        </span>
      )}
    </div>
  )
}
