import * as cheerio from 'cheerio'
import { logger } from './logger'

export class RTNotFoundError extends Error {
  constructor(message = 'RT page not found') {
    super(message)
    this.name = 'RTNotFoundError'
  }
}

// Normalize a title to a URL slug, optionally stripping subtitles
function normalizeToSlug(title: string, stripSubtitle: boolean): string {
  let s = title.toLowerCase()
  if (stripSubtitle) {
    // Strip from first occurrence of " - ", ": ", or " – " onwards
    const match = s.match(/( - |: | – )/)
    if (match && match.index !== undefined) {
      s = s.slice(0, match.index)
    }
  }
  // Remove non-alphanumeric except spaces
  s = s.replace(/[^a-z0-9 ]/g, '')
  // Trim and replace spaces with underscores
  s = s.trim().replace(/\s+/g, '_')
  return s
}

// If a slug contains "_part_N" (numeric) or "_part_word" (spelled-out), return the slug
// with the alternative form of the number, or null if no substitution applies.
// e.g. "dune_part_1" → "dune_part_one", "dune_part_two" → "dune_part_2"
function slugOrdinalVariant(slug: string): string | null {
  const NUM_TO_WORD: Record<string, string> = {
    '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
    '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten',
  }
  const WORD_TO_NUM = Object.fromEntries(Object.entries(NUM_TO_WORD).map(([k, v]) => [v, k]))

  // _part_N → _part_word (with optional trailing _YEAR)
  const numMatch = slug.match(/^(.*_part_)(\d+)(_\d{4})?$/)
  if (numMatch) {
    const word = NUM_TO_WORD[numMatch[2] ?? '']
    if (word) return `${numMatch[1]}${word}${numMatch[3] ?? ''}`
  }

  // _part_word → _part_N (with optional trailing _YEAR)
  const wordMatch = slug.match(/^(.*_part_)([a-z]+)(_\d{4})?$/)
  if (wordMatch) {
    const num = WORD_TO_NUM[wordMatch[2] ?? '']
    if (num) return `${wordMatch[1]}${num}${wordMatch[3] ?? ''}`
  }

  return null
}

function buildCandidateUrls(title: string, releaseYear: number | null, mediaType: 'MOVIE' | 'SHOW'): string[] {
  const shortSlug = normalizeToSlug(title, true)
  const fullSlug = normalizeToSlug(title, false)

  // Helper: push a slug (and its ordinal variant if applicable) as full RT URLs
  const pushMovie = (slug: string, urls: string[]) => {
    const url = `https://www.rottentomatoes.com/m/${slug}`
    urls.push(url)
    const variant = slugOrdinalVariant(slug)
    if (variant) urls.push(`https://www.rottentomatoes.com/m/${variant}`)
  }
  const pushTV = (slug: string, suffix: string, urls: string[]) => {
    const url = `https://www.rottentomatoes.com/tv/${slug}${suffix}`
    urls.push(url)
    const variant = slugOrdinalVariant(slug)
    if (variant) urls.push(`https://www.rottentomatoes.com/tv/${variant}${suffix}`)
  }

  const urls: string[] = []

  if (mediaType === 'MOVIE') {
    // Try year-qualified URLs for both slug variants before falling back to bare slugs.
    // This avoids landing on a same-name film from a different year or era
    // (e.g. LOTR 1978 animated at /m/the_lord_of_the_rings vs the 2001 film at the full-slug URL).
    if (releaseYear) {
      pushMovie(`${shortSlug}_${releaseYear}`, urls)
      if (fullSlug !== shortSlug) {
        pushMovie(`${fullSlug}_${releaseYear}`, urls)
      }
    }
    pushMovie(shortSlug, urls)
    if (fullSlug !== shortSlug) {
      pushMovie(fullSlug, urls)
    }
  } else {
    pushTV(shortSlug, '/s01', urls)
    pushTV(shortSlug, '', urls)
    if (fullSlug !== shortSlug) {
      pushTV(fullSlug, '/s01', urls)
      pushTV(fullSlug, '', urls)
    }
  }

  return [...new Set(urls)] // deduplicate
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (response.status !== 200) return null
    return response.text()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// Levenshtein distance (Wagner-Fischer)
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  // Use a Map to avoid noUncheckedIndexedAccess issues with arrays
  const dp = new Map<number, number>()
  const idx = (i: number, j: number) => i * (n + 1) + j
  const get = (i: number, j: number): number => dp.get(idx(i, j)) ?? 0
  for (let i = 0; i <= m; i++) dp.set(idx(i, 0), i)
  for (let j = 0; j <= n; j++) dp.set(idx(0, j), j)
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp.set(idx(i, j), get(i - 1, j - 1))
      } else {
        dp.set(idx(i, j), 1 + Math.min(get(i - 1, j - 1), get(i - 1, j), get(i, j - 1)))
      }
    }
  }
  return get(m, n)
}

// Normalize a title string for comparison: strip year, season markers, punctuation
function normalizeForComparison(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\(\d{4}\)\s*/g, ' ')       // strip (2021) etc.
    .replace(/\s*:\s*season\s+\d+\b/gi, '') // strip ": Season 1"
    .replace(/\s+season\s+\d+\b/gi, '')     // strip " Season 1"
    .replace(/[^a-z0-9 ]/g, '')             // remove punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

// Map spelled-out and Roman-numeral part numbers to digits for comparison.
// e.g. "two" → "2", "iii" → "3"
const PART_WORD_TO_NUM: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8',
}

function extractPartNumber(s: string): string | null {
  const m = s.match(/\bpart\s+(\w+)\b/i)
  if (!m || !m[1]) return null
  const raw = m[1].toLowerCase()
  return PART_WORD_TO_NUM[raw] ?? raw
}

function titleSimilarity(html: string, storedTitle: string): number {
  const $ = cheerio.load(html)
  const rawPageTitle = $('title').first().text()
  // RT uses both " | Rotten Tomatoes" and " - Rotten Tomatoes" as suffixes
  const pageTitle = normalizeForComparison(rawPageTitle.replace(/\s*[|\-]\s*rotten tomatoes\s*$/i, ''))
  const normalized = normalizeForComparison(storedTitle)

  if (!pageTitle || !normalized) return 0
  if (pageTitle === normalized) return 1

  // Hard-reject if both titles reference a "part N" but the numbers disagree.
  // "Dune - Part 1" vs "Dune: Part Two" → part numbers "1" vs "2" → different films.
  const storedPart = extractPartNumber(storedTitle)
  const pagePart   = extractPartNumber(rawPageTitle)
  if (storedPart !== null && pagePart !== null && storedPart !== pagePart) return 0

  // Stored title is a more-specific version of the page title — the user stored
  // "Dune - Part 1" but RT's canonical page title is just "Dune (2021)".
  // If removing the "part N" qualifier from the stored title yields the page title
  // exactly, this is still a valid match.
  const normalizedWithoutPart = normalized.replace(/\s+part\s+\w+$/, '').trim()
  if (normalizedWithoutPart === pageTitle && normalizedWithoutPart.length > 0) return 0.85

  // Only treat as a prefix match when the PAGE title is longer than the stored title —
  // meaning RT uses a more specific name than we do (e.g. stored "Dune", page "Dune Part One").
  // The reverse (stored title longer than page title) means we likely landed on a different,
  // shorter-named work (e.g. 1978 "The Lord of the Rings" vs stored "...Fellowship of the Ring").
  if (pageTitle.startsWith(normalized) && pageTitle.length <= normalized.length * 1.5) return 0.9

  const maxLen = Math.max(pageTitle.length, normalized.length)
  const dist = levenshtein(pageTitle, normalized)
  return 1 - dist / maxLen
}

function extractScores(html: string): { criticRating: number | null; audienceRating: number | null } {
  let criticRating: number | null = null
  let audienceRating: number | null = null

  // --- Primary: parse <script type="application/json"> blocks ---
  // RT embeds per-movie scores in structured JSON blocks with shape:
  //   { criticsScore: { score: "47" }, audienceScore: { score: "57" } }
  // These are scoped to the page's own movie, unlike inline JS which includes
  // sidebar/recommendation content that would corrupt the score.
  const jsonBlockRegex = /<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = jsonBlockRegex.exec(html)) !== null) {
    const raw = match[1]
    if (raw === undefined) continue
    try {
      const data = JSON.parse(raw.trim()) as Record<string, unknown>
      const criticsScore = data['criticsScore'] as Record<string, unknown> | undefined
      const audienceScore = data['audienceScore'] as Record<string, unknown> | undefined

      if (criticRating === null && criticsScore !== undefined) {
        const s = criticsScore['score']
        const n = typeof s === 'string' ? parseInt(s, 10) : typeof s === 'number' ? s : NaN
        if (!isNaN(n)) criticRating = n
      }

      if (audienceRating === null && audienceScore !== undefined) {
        const s = audienceScore['score']
        const n = typeof s === 'string' ? parseInt(s, 10) : typeof s === 'number' ? s : NaN
        if (!isNaN(n)) audienceRating = n
      }

      if (criticRating !== null && audienceRating !== null) break
    } catch {
      // not valid JSON, skip
    }
  }

  // --- Fallback: DOM selectors for older/alternate page layouts ---
  if (criticRating === null || audienceRating === null) {
    const $ = cheerio.load(html)

    if (criticRating === null) {
      const attr = $('score-board').attr('tomatometerscore')
      if (attr) {
        const n = parseInt(attr, 10)
        if (!isNaN(n)) criticRating = n
      }
    }

    if (criticRating === null) {
      const text = $('[data-qa="tomatometer"]').first().text().trim().replace('%', '')
      const n = parseInt(text, 10)
      if (!isNaN(n)) criticRating = n
    }

    if (audienceRating === null) {
      const attr = $('score-board').attr('audiencescore')
      if (attr) {
        const n = parseInt(attr, 10)
        if (!isNaN(n)) audienceRating = n
      }
    }

    if (audienceRating === null) {
      const text = $('[data-qa="audience-score"]').first().text().trim().replace('%', '')
      const n = parseInt(text, 10)
      if (!isNaN(n)) audienceRating = n
    }
  }

  return { criticRating, audienceRating }
}

async function trySearchFallback(
  title: string,
  releaseYear: number | null,
): Promise<{ criticRating: number | null; audienceRating: number | null } | null> {
  const searchUrl = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`
  logger.info({ logId: 'pale-seeking-search', title, searchUrl }, 'Trying RT search fallback')

  const html = await fetchPage(searchUrl)
  if (!html) return null

  const $ = cheerio.load(html)
  const candidateHrefs: string[] = []

  // Try to extract hrefs from rendered search result links
  $('[data-qa="search-result-link"]').each((_i, el) => {
    const href = $(el).attr('href')
    if (href) candidateHrefs.push(href)
  })

  // Also try <search-page-result> elements
  $('search-page-result').each((_i, el) => {
    const href = $(el).attr('url') ?? $(el).find('a').first().attr('href')
    if (href) candidateHrefs.push(href)
  })

  // Try embedded JSON in <script> tags
  $('script').each((_i, el) => {
    const content = $(el).html() ?? ''
    // RT sometimes embeds search results as JSON
    const jsonMatch = content.match(/window\.__RT_STATE__\s*=\s*(\{.+?\});?\s*<\/script>/s)
    if (!jsonMatch || jsonMatch[1] === undefined) return
    try {
      const state = JSON.parse(jsonMatch[1]) as Record<string, unknown>
      // Walk the state tree looking for url/slug fields
      const walk = (obj: unknown): void => {
        if (!obj || typeof obj !== 'object') return
        if (Array.isArray(obj)) {
          obj.forEach(walk)
          return
        }
        const record = obj as Record<string, unknown>
        const url = record['url'] as string | undefined
        if (url && (url.includes('/m/') || url.includes('/tv/'))) {
          candidateHrefs.push(url)
        }
        Object.values(record).forEach(walk)
      }
      walk(state)
    } catch {
      // ignore JSON parse errors
    }
  })

  // Deduplicate
  const unique = [...new Set(candidateHrefs)]

  // Score and filter by title similarity
  type Candidate = { href: string; similarity: number; yearMatch: boolean }
  const scored: Candidate[] = []

  for (const href of unique) {
    const fullUrl = href.startsWith('http') ? href : `https://www.rottentomatoes.com${href}`
    const slug = fullUrl.split('/').pop() ?? ''
    const slugAsTitle = normalizeForComparison(slug.replace(/_/g, ' '))
    const normalizedInputTitle = normalizeForComparison(title)
    const sim = 1 - levenshtein(slugAsTitle, normalizedInputTitle) / Math.max(slugAsTitle.length, normalizedInputTitle.length, 1)
    const yearMatch = releaseYear !== null && fullUrl.includes(String(releaseYear))
    if (sim >= 0.55) {
      scored.push({ href: fullUrl, similarity: sim, yearMatch })
    }
  }

  if (scored.length === 0) return null

  // Sort: year match first, then by similarity
  scored.sort((a, b) => {
    if (a.yearMatch !== b.yearMatch) return a.yearMatch ? -1 : 1
    return b.similarity - a.similarity
  })

  for (const candidate of scored) {
    const pageHtml = await fetchPage(candidate.href)
    if (!pageHtml) continue
    const sim = titleSimilarity(pageHtml, title)
    if (sim < 0.55) continue
    const scores = extractScores(pageHtml)
    if (scores.criticRating === null && scores.audienceRating === null) continue
    logger.info(
      { logId: 'gold-landing-result', url: candidate.href, sim, criticRating: scores.criticRating, audienceRating: scores.audienceRating },
      'RT search fallback succeeded',
    )
    return scores
  }

  return null
}

export async function fetchRTRatings(
  title: string,
  releaseYear: number | null,
  mediaType: 'MOVIE' | 'SHOW',
): Promise<{ criticRating: number | null; audienceRating: number | null }> {
  const candidates = buildCandidateUrls(title, releaseYear, mediaType)

  for (const url of candidates) {
    logger.info({ logId: 'lean-trying-url', url, title }, 'Trying RT candidate URL')
    const html = await fetchPage(url)
    if (!html) continue

    const sim = titleSimilarity(html, title)
    if (sim < 0.55) {
      logger.info({ logId: 'cold-skipping-page', url, sim }, 'RT page title similarity too low, skipping')
      continue
    }

    const scores = extractScores(html)
    if (scores.criticRating === null && scores.audienceRating === null) {
      logger.info({ logId: 'gray-missing-scores', url }, 'RT page found but no scores extracted, continuing')
      continue
    }

    logger.info(
      { logId: 'warm-found-scores', url, criticRating: scores.criticRating, audienceRating: scores.audienceRating },
      'RT scores extracted from candidate URL',
    )
    return scores
  }

  // Search fallback
  const fallback = await trySearchFallback(title, releaseYear)
  if (fallback) return fallback

  logger.warn({ logId: 'bare-lost-title', title, mediaType }, 'RT ratings not found for title')
  throw new RTNotFoundError(`No RT ratings found for "${title}"`)
}
