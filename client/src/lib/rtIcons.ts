export function criticIcon(score: number): string {
  if (score >= 75) return '/rt-icons/certified-fresh.svg'
  if (score >= 60) return '/rt-icons/fresh.svg'
  return '/rt-icons/rotten.svg'
}

export function audienceIcon(score: number): string {
  return score >= 60 ? '/rt-icons/popcorn-full.svg' : '/rt-icons/popcorn-spilled.svg'
}
