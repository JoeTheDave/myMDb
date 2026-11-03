import { Router, Request, Response } from 'express'
import { z } from 'zod'
import axios from 'axios'
import type { ContentRating } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { uploadBufferToS3 } from '../lib/s3'
import { logger } from '../lib/logger'
import { getTmdbId, type MediaType } from '../lib/tmdb'

const router = Router()

const TMDB_API = 'https://api.themoviedb.org/3'
const CREDITS_TTL_MS = 12 * 60 * 60 * 1000
const MIN_VOTE_COUNT = 20
// TMDb genre ids: Documentary, News, Reality, Talk
const EXCLUDED_GENRES = new Set([99, 10763, 10764, 10767])
const SELF_CHARACTER = /^(self|himself|herself|themselves|narrator)\b/i

type TmdbCredit = {
  id: number
  media_type: 'movie' | 'tv'
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  popularity?: number
  vote_count?: number
  genre_ids?: number[]
  character?: string
}

type Candidate = {
  tmdbId: number
  mediaType: MediaType
  title: string
  releaseYear: number | null
  posterUrl: string | null
  popularity: number
  actors: Array<{ id: string; name: string; imageUrl: string | null; character: string | null }>
}

function tmdbHeaders() {
  return { Authorization: `Bearer ${process.env['TMDB_READ_ACCESS_TOKEN']}` }
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// Per-process caches — Explore is read-heavy and TMDb filmographies change slowly
const creditsCache = new Map<number, { at: number; credits: TmdbCredit[] }>()
const backfillAttemptedMediaIds = new Set<string>()

export function clearExploreCaches() {
  creditsCache.clear()
  backfillAttemptedMediaIds.clear()
}

async function getPersonCredits(tmdbPersonId: number): Promise<TmdbCredit[]> {
  const cached = creditsCache.get(tmdbPersonId)
  if (cached && Date.now() - cached.at < CREDITS_TTL_MS) return cached.credits
  try {
    const response = await axios.get(`${TMDB_API}/person/${tmdbPersonId}/combined_credits`, {
      headers: tmdbHeaders(),
      timeout: 15000,
    })
    const credits = ((response.data as { cast?: TmdbCredit[] }).cast ?? [])
    creditsCache.set(tmdbPersonId, { at: Date.now(), credits })
    return credits
  } catch (err) {
    logger.warn({ logId: 'pale-fetching-filmography', err, tmdbPersonId }, 'Failed to fetch TMDb combined credits')
    return []
  }
}

// Actors created before tmdbPersonId existed: match them against the TMDb credits of
// the media they're already in (more reliable than a bare name search).
async function backfillPersonIds(): Promise<void> {
  const actors = await prisma.actor.findMany({
    where: { tmdbPersonId: null, castRoles: { some: {} } },
    select: {
      id: true,
      name: true,
      castRoles: {
        select: { media: { select: { id: true, title: true, releaseYear: true, mediaType: true, imdbId: true, tmdbId: true } } },
      },
    },
  })
  if (actors.length === 0) return

  type MediaRef = { id: string; title: string; releaseYear: number | null; mediaType: MediaType; imdbId: string | null; tmdbId: number | null }
  const mediaById = new Map<string, MediaRef>()
  const pendingNames = new Map<string, string>() // normalized name → actor id
  for (const actor of actors) {
    pendingNames.set(normalize(actor.name), actor.id)
    for (const role of actor.castRoles) {
      if (!backfillAttemptedMediaIds.has(role.media.id)) mediaById.set(role.media.id, role.media)
    }
  }

  await mapLimit([...mediaById.values()], 4, async (media) => {
    backfillAttemptedMediaIds.add(media.id)
    try {
      const tmdbId = media.tmdbId ?? await getTmdbId(media)
      if (!media.tmdbId) {
        await prisma.media.update({ where: { id: media.id }, data: { tmdbId } })
      }
      const path = media.mediaType === 'SHOW' ? `tv/${tmdbId}/credits` : `movie/${tmdbId}/credits`
      const response = await axios.get(`${TMDB_API}/${path}`, { headers: tmdbHeaders(), timeout: 15000 })
      const cast = (response.data as { cast?: Array<{ id: number; name: string }> }).cast ?? []
      for (const member of cast) {
        const key = normalize(member.name)
        const actorId = pendingNames.get(key)
        if (!actorId) continue
        pendingNames.delete(key)
        await prisma.actor.updateMany({ where: { id: actorId, tmdbPersonId: null }, data: { tmdbPersonId: member.id } })
      }
    } catch (err) {
      logger.warn({ logId: 'grey-backfilling-person', err, mediaId: media.id }, 'Failed to backfill TMDb person ids from media credits')
    }
  })
}

function posterUrl(path: string | null | undefined, size = 'w342'): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null
}

async function buildCandidates(): Promise<Candidate[]> {
  await backfillPersonIds()

  const [actors, existingMedia, dismissals] = await Promise.all([
    prisma.actor.findMany({
      where: { tmdbPersonId: { not: null } },
      select: { id: true, name: true, imageUrl: true, tmdbPersonId: true },
    }),
    prisma.media.findMany({ select: { title: true, releaseYear: true, mediaType: true, tmdbId: true } }),
    prisma.exploreDismissal.findMany({ select: { tmdbId: true, mediaType: true } }),
  ])

  const excludedIds = new Set<string>()
  const excludedTitles = new Set<string>()
  for (const m of existingMedia) {
    if (m.tmdbId) excludedIds.add(`${m.mediaType}:${m.tmdbId}`)
    excludedTitles.add(`${m.mediaType}:${normalize(m.title)}:${m.releaseYear ?? ''}`)
  }
  for (const d of dismissals) excludedIds.add(`${d.mediaType}:${d.tmdbId}`)

  const today = new Date().toISOString().slice(0, 10)
  const candidates = new Map<string, Candidate>()

  const filmographies = await mapLimit(actors, 8, a => getPersonCredits(a.tmdbPersonId as number))

  actors.forEach((actor, i) => {
    for (const credit of filmographies[i] ?? []) {
      const mediaType: MediaType = credit.media_type === 'tv' ? 'SHOW' : 'MOVIE'
      const title = credit.title ?? credit.name
      const date = credit.release_date ?? credit.first_air_date
      if (!title || !date || date > today) continue
      if ((credit.vote_count ?? 0) < MIN_VOTE_COUNT) continue
      if (credit.genre_ids?.some(g => EXCLUDED_GENRES.has(g))) continue
      if (credit.character && SELF_CHARACTER.test(credit.character.trim())) continue

      const key = `${mediaType}:${credit.id}`
      const releaseYear = parseInt(date.slice(0, 4), 10) || null
      if (excludedIds.has(key) || excludedTitles.has(`${mediaType}:${normalize(title)}:${releaseYear ?? ''}`)) continue

      let candidate = candidates.get(key)
      if (!candidate) {
        candidate = {
          tmdbId: credit.id,
          mediaType,
          title,
          releaseYear,
          posterUrl: posterUrl(credit.poster_path),
          popularity: credit.popularity ?? 0,
          actors: [],
        }
        candidates.set(key, candidate)
      }
      if (!candidate.actors.some(a => a.id === actor.id)) {
        candidate.actors.push({ id: actor.id, name: actor.name, imageUrl: actor.imageUrl, character: credit.character || null })
      }
    }
  })

  return [...candidates.values()].sort(
    (a, b) => b.actors.length - a.actors.length || b.popularity - a.popularity,
  )
}

// GET /api/explore?page=&limit=
router.get('/', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '24'), 10) || 24))
  try {
    const all = await buildCandidates()
    const start = (page - 1) * limit
    res.json({
      items: all.slice(start, start + limit),
      total: all.length,
      page,
      totalPages: Math.max(1, Math.ceil(all.length / limit)),
    })
  } catch (err) {
    logger.error({ logId: 'dark-building-explore', err }, 'Failed to build explore candidates')
    res.status(500).json({ error: 'Internal server error' })
  }
})

const candidateRefSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['MOVIE', 'SHOW']),
  title: z.string().max(500).optional(),
})

const MOVIE_CERTS: Record<string, ContentRating> = { 'G': 'G', 'PG': 'PG', 'PG-13': 'PG_13', 'R': 'R', 'NC-17': 'NC_17', 'NR': 'NR' }
const TV_CERTS: Record<string, ContentRating> = { 'TV-Y': 'TV_Y', 'TV-Y7': 'TV_Y7', 'TV-G': 'TV_G', 'TV-PG': 'TV_PG', 'TV-14': 'TV_14', 'TV-MA': 'TV_MA' }

// POST /api/explore/add — create the media from TMDb data
router.post('/add', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const parsed = candidateRefSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { tmdbId, mediaType } = parsed.data

  const existing = await prisma.media.findFirst({ where: { tmdbId, mediaType }, select: { id: true } })
  if (existing) {
    res.status(409).json({ error: 'Already in the database', id: existing.id })
    return
  }

  let title: string
  let releaseYear: number | null = null
  let imdbId: string | null = null
  let contentRating: ContentRating | null = null
  let posterPath: string | null = null
  try {
    if (mediaType === 'MOVIE') {
      const response = await axios.get(`${TMDB_API}/movie/${tmdbId}`, {
        params: { append_to_response: 'release_dates' },
        headers: tmdbHeaders(),
        timeout: 15000,
      })
      const d = response.data as {
        title: string
        release_date?: string
        imdb_id?: string | null
        poster_path?: string | null
        release_dates?: { results?: Array<{ iso_3166_1: string; release_dates: Array<{ type: number; certification: string }> }> }
      }
      title = d.title
      releaseYear = d.release_date ? parseInt(d.release_date.slice(0, 4), 10) || null : null
      imdbId = d.imdb_id ?? null
      posterPath = d.poster_path ?? null
      const us = d.release_dates?.results?.find(r => r.iso_3166_1 === 'US')
      const cert = us?.release_dates.find(rd => rd.type === 3 && rd.certification)?.certification
        ?? us?.release_dates.find(rd => rd.certification)?.certification
      contentRating = cert ? MOVIE_CERTS[cert] ?? null : null
    } else {
      const response = await axios.get(`${TMDB_API}/tv/${tmdbId}`, {
        params: { append_to_response: 'external_ids,content_ratings' },
        headers: tmdbHeaders(),
        timeout: 15000,
      })
      const d = response.data as {
        name: string
        first_air_date?: string
        poster_path?: string | null
        external_ids?: { imdb_id?: string | null }
        content_ratings?: { results?: Array<{ iso_3166_1: string; rating: string }> }
      }
      title = d.name
      releaseYear = d.first_air_date ? parseInt(d.first_air_date.slice(0, 4), 10) || null : null
      imdbId = d.external_ids?.imdb_id ?? null
      posterPath = d.poster_path ?? null
      const rating = d.content_ratings?.results?.find(r => r.iso_3166_1 === 'US')?.rating
      contentRating = rating ? TV_CERTS[rating] ?? null : null
    }
  } catch (err) {
    logger.error({ logId: 'dark-fetching-explore-title', err, tmdbId, mediaType }, 'Failed to fetch TMDb details for explore add')
    res.status(502).json({ error: 'Could not load details from TMDb' })
    return
  }

  let imageUrl: string | null = null
  if (posterPath) {
    try {
      const img = await axios.get(posterUrl(posterPath, 'w500') as string, { responseType: 'arraybuffer', timeout: 15000 })
      imageUrl = await uploadBufferToS3(Buffer.from(img.data as ArrayBuffer), 'image/jpeg', 'poster.jpg')
    } catch (err) {
      logger.warn({ logId: 'soft-uploading-explore-poster', err, tmdbId }, 'Failed to download/upload poster for explore add')
    }
  }

  try {
    const media = await prisma.media.create({
      data: {
        title,
        mediaType,
        releaseYear,
        imdbId,
        tmdbId,
        imageUrl,
        contentRating,
      },
      select: { id: true, title: true, releaseYear: true, mediaType: true, imageUrl: true },
    })
    await prisma.exploreDismissal.deleteMany({ where: { tmdbId, mediaType } })
    logger.info({ logId: 'keen-adding-explore', mediaId: media.id, tmdbId }, 'Media added from explore')
    res.status(201).json(media)
  } catch (err) {
    logger.error({ logId: 'stout-adding-explore', err, tmdbId }, 'Failed to create media from explore')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/explore/dismiss — never suggest this title again
router.post('/dismiss', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const parsed = candidateRefSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { tmdbId, mediaType, title } = parsed.data
  try {
    await prisma.exploreDismissal.upsert({
      where: { tmdbId_mediaType: { tmdbId, mediaType } },
      create: { tmdbId, mediaType, title: title ?? null },
      update: {},
    })
    res.status(204).end()
  } catch (err) {
    logger.error({ logId: 'dark-dismissing-explore', err, tmdbId }, 'Failed to dismiss explore candidate')
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
