import { Router, Request, Response } from 'express'
import { z } from 'zod'
import axios from 'axios'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { deleteS3Object, uploadBufferToS3 } from '../lib/s3'
import { logger } from '../lib/logger'
import { fetchRTRatings, RTNotFoundError } from '../lib/rtScraper'

const router = Router()

const MOVIE_RATINGS = ['G', 'PG', 'PG_13', 'R', 'NC_17', 'NR'] as const
const TV_RATINGS = ['TV_Y', 'TV_Y7', 'TV_G', 'TV_PG', 'TV_14', 'TV_MA'] as const
type MovieRating = (typeof MOVIE_RATINGS)[number]
type TvRating = (typeof TV_RATINGS)[number]

const contentRatingEnum = z.enum([...MOVIE_RATINGS, ...TV_RATINGS])

const createMediaSchema = z.object({
  title: z.string().min(1),
  mediaType: z.enum(['MOVIE', 'SHOW']),
  imageUrl: z.string().url().optional(),
  releaseYear: z.coerce.number().int().min(1888).max(2100).optional(),
  contentRating: contentRatingEnum.optional(),
})

const updateMediaSchema = createMediaSchema.partial()

function validateContentRating(mediaType: 'MOVIE' | 'SHOW', contentRating?: string): boolean {
  if (!contentRating) return true
  if (mediaType === 'MOVIE') return (MOVIE_RATINGS as readonly string[]).includes(contentRating)
  return (TV_RATINGS as readonly string[]).includes(contentRating)
}

const listQuerySchema = z.object({
  q: z.string().optional(),
  type: z.enum(['MOVIE', 'SHOW']).optional(),
  contentRating: z.string().optional(),
  yearFrom: z.string().optional(),
  yearTo: z.string().optional(),
  actorId: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
})

function isS3Url(url: string | null | undefined): boolean {
  return !!url && url.includes('.s3.') && url.includes('amazonaws.com')
}

type MediaType = 'MOVIE' | 'SHOW'

async function getTmdbId(media: {
  title: string
  releaseYear: number | null
  mediaType: MediaType
  imdbId?: string | null
}): Promise<number> {
  const tmdbToken = process.env['TMDB_READ_ACCESS_TOKEN']
  const headers = { Authorization: `Bearer ${tmdbToken}` }

  if (media.imdbId) {
    const findResponse = await axios.get(`https://api.themoviedb.org/3/find/${media.imdbId}`, {
      params: { external_source: 'imdb_id' },
      headers,
      timeout: 15000,
    })
    type FindData = { movie_results?: Array<{ id: number }>; tv_results?: Array<{ id: number }> }
    const findData = findResponse.data as FindData
    const result = media.mediaType === 'SHOW' ? findData.tv_results?.[0] : findData.movie_results?.[0]
    if (result) return result.id
  }

  // Fall back to title + year search
  const endpoint = media.mediaType === 'SHOW'
    ? 'https://api.themoviedb.org/3/search/tv'
    : 'https://api.themoviedb.org/3/search/movie'
  const params: Record<string, string | number> = { query: media.title, page: 1 }
  if (media.releaseYear) params['year'] = media.releaseYear
  const searchResponse = await axios.get(endpoint, { params, headers, timeout: 15000 })
  type SearchData = { results?: Array<{ id: number }> }
  const searchData = searchResponse.data as SearchData
  const first = searchData.results?.[0]
  if (!first) throw new Error(`No TMDb result for title: ${media.title}`)
  return first.id
}

async function enrichNewActor(
  tmdbPersonId: number,
  profilePath: string | null,
): Promise<{ birthday: Date | null; deathDay: Date | null; imageUrl: string | null }> {
  const tmdbToken = process.env['TMDB_READ_ACCESS_TOKEN']
  const headers = { Authorization: `Bearer ${tmdbToken}` }

  let birthday: Date | null = null
  let deathDay: Date | null = null
  let imageUrl: string | null = null

  try {
    const personResponse = await axios.get(
      `https://api.themoviedb.org/3/person/${tmdbPersonId}`,
      { headers, timeout: 15000 },
    )
    type PersonData = { birthday?: string | null; deathday?: string | null }
    const personData = personResponse.data as PersonData
    if (personData.birthday) birthday = new Date(personData.birthday)
    if (personData.deathday) deathDay = new Date(personData.deathday)
  } catch (err) {
    logger.warn({ logId: 'pale-fetching-person', err, tmdbPersonId }, 'Failed to fetch TMDb person details')
  }

  if (profilePath) {
    try {
      const imgResponse = await axios.get(`https://image.tmdb.org/t/p/w500${profilePath}`, {
        responseType: 'arraybuffer',
        timeout: 15000,
      })
      imageUrl = await uploadBufferToS3(
        Buffer.from(imgResponse.data as ArrayBuffer),
        'image/jpeg',
        'actor-profile.jpg',
      )
    } catch (err) {
      logger.warn({ logId: 'soft-uploading-face', err, tmdbPersonId }, 'Failed to download/upload actor profile image')
    }
  }

  return { birthday, deathDay, imageUrl }
}

// GET /api/media
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { q, type, contentRating, yearFrom, yearTo, actorId, page, limit } = parsed.data
  const pageNum = Math.max(1, parseInt(page ?? '1', 10))
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '24', 10)))
  const skip = (pageNum - 1) * limitNum

  try {
    // Build where clause as a typed object
    type ContentRatingValue = MovieRating | TvRating

    const whereClause: {
      title?: { contains: string; mode: 'insensitive' }
      mediaType?: 'MOVIE' | 'SHOW'
      contentRating?: { in: ContentRatingValue[] }
      releaseYear?: { gte?: number; lte?: number }
      castRoles?: { some: { actorId: string } }
    } = {}

    if (q) {
      whereClause.title = { contains: q, mode: 'insensitive' }
    }
    if (type) {
      whereClause.mediaType = type
    }
    if (contentRating) {
      const ratings = contentRating
        .split(',')
        .map(r => r.trim())
        .filter(Boolean) as ContentRatingValue[]
      if (ratings.length > 0) {
        whereClause.contentRating = { in: ratings }
      }
    }
    if (yearFrom || yearTo) {
      whereClause.releaseYear = {}
      if (yearFrom) {
        whereClause.releaseYear.gte = parseInt(yearFrom, 10)
      }
      if (yearTo) {
        whereClause.releaseYear.lte = parseInt(yearTo, 10)
      }
    }
    if (actorId) {
      whereClause.castRoles = { some: { actorId } }
    }

    const [items, total] = await Promise.all([
      prisma.media.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: { title: 'asc' },
        select: {
          id: true,
          title: true,
          imageUrl: true,
          releaseYear: true,
          mediaType: true,
          contentRating: true,
          criticRating: true,
          audienceRating: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.media.count({ where: whereClause }),
    ])

    res.json({
      items,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    })
  } catch (err) {
    logger.error({ logId: 'amber-seeking-leaf', err }, 'Failed to list media')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/media/:id
router.get('/:id', authenticate, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  try {
    const media = await prisma.media.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        releaseYear: true,
        mediaType: true,
        contentRating: true,
        criticRating: true,
        audienceRating: true,
        amazonPrimeUrl: true,
        trailerUrl: true,
        createdAt: true,
        updatedAt: true,
        castSortOrder: true,
        castRoles: {
          select: {
            id: true,
            characterName: true,
            roleImageUrl: true,
            billingOrder: true,
            actor: {
              select: { id: true, name: true, imageUrl: true },
            },
          },
          orderBy: { billingOrder: 'asc' },
        },
      },
    })

    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    res.json({
      id: media.id,
      title: media.title,
      imageUrl: media.imageUrl,
      releaseYear: media.releaseYear,
      mediaType: media.mediaType,
      contentRating: media.contentRating,
      criticRating: media.criticRating,
      audienceRating: media.audienceRating,
      amazonPrimeUrl: media.amazonPrimeUrl,
      trailerUrl: media.trailerUrl,
      castSortOrder: media.castSortOrder,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
      cast: media.castRoles,
    })
  } catch (err) {
    logger.error({ logId: 'rich-finding-peak', err }, 'Failed to fetch media by id')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/media
router.post('/', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createMediaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { contentRating, mediaType } = parsed.data
  if (!validateContentRating(mediaType, contentRating)) {
    res.status(400).json({ error: `Invalid contentRating for mediaType ${mediaType}` })
    return
  }
  try {
    const media = await prisma.media.create({
      data: {
        title: parsed.data.title,
        mediaType: parsed.data.mediaType,
        imageUrl: parsed.data.imageUrl ?? null,
        releaseYear: parsed.data.releaseYear ?? null,
        contentRating: parsed.data.contentRating ?? null,
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        releaseYear: true,
        mediaType: true,
        contentRating: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    logger.info({ logId: 'keen-making-shore', mediaId: media.id }, 'Media created')
    res.status(201).json(media)
  } catch (err) {
    logger.error({ logId: 'stout-pushing-cliff', err }, 'Failed to create media')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/media/:id
router.put('/:id', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  const parsed = updateMediaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { contentRating, mediaType } = parsed.data
  if (mediaType && contentRating !== undefined && !validateContentRating(mediaType, contentRating)) {
    res.status(400).json({ error: `Invalid contentRating for mediaType ${mediaType}` })
    return
  }
  try {
    const existing = await prisma.media.findUnique({ where: { id }, select: { id: true, imageUrl: true } })
    if (!existing) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    const media = await prisma.media.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.mediaType !== undefined ? { mediaType: parsed.data.mediaType } : {}),
        ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl } : {}),
        ...(parsed.data.releaseYear !== undefined ? { releaseYear: parsed.data.releaseYear } : {}),
        ...(parsed.data.contentRating !== undefined ? { contentRating: parsed.data.contentRating } : {}),
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        releaseYear: true,
        mediaType: true,
        contentRating: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Clean up old S3 image if imageUrl changed
    if (
      parsed.data.imageUrl !== undefined &&
      parsed.data.imageUrl !== existing.imageUrl &&
      isS3Url(existing.imageUrl)
    ) {
      await deleteS3Object(existing.imageUrl!)
    }

    logger.info({ logId: 'solid-marking-path', mediaId: media.id }, 'Media updated')
    res.json(media)
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Media not found' })
      return
    }
    logger.error({ logId: 'grim-driving-hull', err }, 'Failed to update media')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/media/:id
router.delete('/:id', authenticate, authorize('ADMIN'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  try {
    const media = await prisma.media.findUnique({
      where: { id },
      select: {
        id: true,
        imageUrl: true,
        castRoles: { select: { roleImageUrl: true } },
      },
    })
    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    // Delete cast role S3 images
    const castRoles = media.castRoles as Array<{ roleImageUrl: string | null }>
    for (const role of castRoles) {
      if (isS3Url(role.roleImageUrl)) {
        await deleteS3Object(role.roleImageUrl!)
      }
    }
    // Delete media image
    if (isS3Url(media.imageUrl as string | null)) {
      await deleteS3Object((media.imageUrl as string)!)
    }

    await prisma.media.delete({ where: { id } })
    logger.info({ logId: 'sharp-cutting-vine', mediaId: id }, 'Media deleted')
    res.status(204).send()
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Media not found' })
      return
    }
    logger.error({ logId: 'thin-falling-grove', err }, 'Failed to delete media')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/media/:id/fetch-ratings
router.patch('/:id/fetch-ratings', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  try {
    const media = await prisma.media.findUnique({
      where: { id },
      select: { id: true, title: true, releaseYear: true, mediaType: true },
    })
    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    const { criticRating, audienceRating } = await fetchRTRatings(
      media.title,
      media.releaseYear,
      media.mediaType as 'MOVIE' | 'SHOW',
    )

    const updated = await prisma.media.update({
      where: { id },
      data: { criticRating, audienceRating },
      select: { criticRating: true, audienceRating: true },
    })

    logger.info({ logId: 'swift-pulling-score', mediaId: id, criticRating, audienceRating }, 'RT ratings fetched and saved')
    res.json({ criticRating: updated.criticRating, audienceRating: updated.audienceRating })
  } catch (err) {
    if (err instanceof RTNotFoundError) {
      res.status(422).json({ error: 'Could not find this title on Rotten Tomatoes.' })
      return
    }
    logger.error({ logId: 'dark-failing-scrape', err }, 'Failed to fetch RT ratings')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/media/:id/cast/import
router.post('/:id/cast/import', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  const { imdbId } = req.body as { imdbId?: string }

  if (!imdbId || !/^tt\d+$/.test(imdbId)) {
    res.status(400).json({ error: 'Invalid imdbId. Must match /^tt\\d+$/' })
    return
  }

  let media: { id: string; mediaType: string } | null
  try {
    media = await prisma.media.findUnique({ where: { id }, select: { id: true, mediaType: true } })
  } catch (err) {
    logger.error({ logId: 'cold-seeking-cast', err, mediaId: id }, 'Failed to fetch media for cast import')
    res.status(500).json({ error: 'Internal server error' })
    return
  }
  if (!media) {
    res.status(404).json({ error: 'Media not found' })
    return
  }

  // Step 1: Map IMDB ID → TMDb ID via /find endpoint
  let tmdbId: number
  try {
    tmdbId = await getTmdbId({
      title: '',
      releaseYear: null,
      mediaType: media.mediaType as MediaType,
      imdbId,
    })
  } catch (err) {
    logger.error({ logId: 'faint-pulling-tmdb', err, imdbId }, 'Failed to query TMDb /find for IMDB ID')
    res.status(422).json({ error: 'Title not found on TMDb. Verify the IMDB ID.' })
    return
  }

  // Step 2: Fetch cast from TMDb credits endpoint
  type TmdbCastMember = { id: number; name: string; character: string; profile_path: string | null }
  let castEntries: Array<{ tmdbPersonId: number; actorName: string; character: string; profilePath: string | null }>
  try {
    const creditsEndpoint = media.mediaType === 'SHOW'
      ? `https://api.themoviedb.org/3/tv/${tmdbId}/credits`
      : `https://api.themoviedb.org/3/movie/${tmdbId}/credits`
    const tmdbToken = process.env['TMDB_READ_ACCESS_TOKEN']
    const creditsResponse = await axios.get(creditsEndpoint, {
      headers: { Authorization: `Bearer ${tmdbToken}` },
      timeout: 15000,
    })
    const creditsData = creditsResponse.data as { cast?: TmdbCastMember[] }
    const rawCast = creditsData.cast ?? []
    if (rawCast.length === 0) {
      logger.warn({ logId: 'pale-missing-credits', imdbId, tmdbId }, 'No cast data returned from TMDb credits')
      res.status(422).json({ error: 'No cast data found on TMDb for this title.' })
      return
    }
    castEntries = rawCast.map((member) => ({
      tmdbPersonId: member.id,
      actorName: member.name,
      character: member.character,
      profilePath: member.profile_path,
    }))
  } catch (err) {
    logger.error({ logId: 'blunt-breaking-credits', err, tmdbId }, 'Failed to fetch TMDb credits')
    res.status(422).json({ error: 'No cast data found on TMDb for this title.' })
    return
  }

  let imported = 0
  let matched = 0
  let created = 0
  let skipped = 0

  // Batch-load existing actors and cast roles to avoid N+1 queries
  const allNames = castEntries.map(e => e.actorName)

  let existingActors: Array<{ id: string; name: string }>
  let existingCastRoleActorIds: Array<{ actorId: string }>
  try {
    ;[existingActors, existingCastRoleActorIds] = await Promise.all([
      prisma.actor.findMany({
        where: { name: { in: allNames, mode: 'insensitive' } },
        select: { id: true, name: true },
      }),
      prisma.castRole.findMany({
        where: { mediaId: id },
        select: { actorId: true },
      }),
    ])
  } catch (err) {
    logger.error({ logId: 'grey-loading-cast', err, mediaId: id }, 'Failed to batch-load actors/cast roles for import')
    res.status(500).json({ error: 'Internal server error' })
    return
  }

  const actorByName = new Map(existingActors.map(a => [a.name.toLowerCase(), a]))
  const castRoleActorIds = new Set(existingCastRoleActorIds.map(r => r.actorId))

  // Collect new actors to enrich
  const newActorEntries: Array<{ index: number; tmdbPersonId: number; actorName: string; character: string; profilePath: string | null }> = []
  const matchedEntries: Array<{ index: number; actorName: string; character: string; existingActorId: string }> = []

  for (let i = 0; i < castEntries.length; i++) {
    const entry = castEntries[i]
    if (!entry) continue
    const existingActor = actorByName.get(entry.actorName.toLowerCase())
    if (existingActor) {
      matchedEntries.push({ index: i, actorName: entry.actorName, character: entry.character, existingActorId: existingActor.id })
    } else {
      newActorEntries.push({ index: i, tmdbPersonId: entry.tmdbPersonId, actorName: entry.actorName, character: entry.character, profilePath: entry.profilePath })
    }
  }

  // Enrich all new actors concurrently (best-effort — never increments skipped on failure)
  const enrichmentResults = await Promise.allSettled(
    newActorEntries.map(e => enrichNewActor(e.tmdbPersonId, e.profilePath))
  )

  // Process matched actors
  for (const entry of matchedEntries) {
    try {
      matched++
      if (castRoleActorIds.has(entry.existingActorId)) {
        skipped++
        continue
      }
      await prisma.castRole.create({
        data: { mediaId: id, actorId: entry.existingActorId, characterName: entry.character || null, billingOrder: entry.index },
      })
      castRoleActorIds.add(entry.existingActorId)
      imported++
    } catch (err) {
      logger.error({ logId: 'dull-skipping-cast', err, actorName: entry.actorName }, 'Failed to import cast member')
      skipped++
    }
  }

  // Process new actors (with enrichment data)
  for (let i = 0; i < newActorEntries.length; i++) {
    const entry = newActorEntries[i]
    if (!entry) continue
    const enrichment = enrichmentResults[i]
    const enrichData = enrichment?.status === 'fulfilled' ? enrichment.value : { birthday: null, deathDay: null, imageUrl: null }
    try {
      created++
      const newActor = await prisma.actor.create({
        data: {
          name: entry.actorName,
          birthday: enrichData.birthday,
          deathDay: enrichData.deathDay,
          imageUrl: enrichData.imageUrl,
        },
      })
      actorByName.set(entry.actorName.toLowerCase(), newActor)
      await prisma.castRole.create({
        data: { mediaId: id, actorId: newActor.id, characterName: entry.character || null, billingOrder: entry.index },
      })
      castRoleActorIds.add(newActor.id)
      imported++
    } catch (err) {
      logger.error({ logId: 'dull-skipping-cast', err, actorName: entry.actorName }, 'Failed to import cast member')
      skipped++
    }
  }

  logger.info({ logId: 'swift-loading-cast', mediaId: id, imdbId, imported, matched, created, skipped }, 'Cast import complete')
  res.json({ imported, matched, created, skipped })
})

// POST /api/media/:id/amazon-lookup
router.post('/:id/amazon-lookup', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params

  let media: { id: string; title: string; releaseYear: number | null; mediaType: string } | null
  try {
    media = await prisma.media.findUnique({
      where: { id },
      select: { id: true, title: true, releaseYear: true, mediaType: true },
    })
  } catch (err) {
    logger.error({ logId: 'grim-seeking-prime', err, mediaId: id }, 'Failed to fetch media for Amazon lookup')
    res.status(500).json({ error: 'Internal server error' })
    return
  }
  if (!media) {
    res.status(404).json({ error: 'Media not found' })
    return
  }

  let tmdbId: number
  try {
    tmdbId = await getTmdbId({ title: media.title, releaseYear: media.releaseYear, mediaType: media.mediaType as MediaType })
  } catch (err) {
    logger.error({ logId: 'grey-seeking-tmdb-prime', err, mediaId: id }, 'Failed to get TMDb ID for Amazon lookup')
    res.status(422).json({ error: 'Title not found on TMDb.' })
    return
  }

  let amazonPrimeUrl: string | null = null
  try {
    const endpoint = media.mediaType === 'SHOW'
      ? `https://api.themoviedb.org/3/tv/${tmdbId}/watch/providers`
      : `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers`
    const tmdbToken = process.env['TMDB_READ_ACCESS_TOKEN']
    const providersResponse = await axios.get(endpoint, {
      headers: { Authorization: `Bearer ${tmdbToken}` },
      timeout: 15000,
    })
    type ProvidersData = { results?: { US?: { link?: string; flatrate?: unknown[]; rent?: unknown[]; buy?: unknown[] } } }
    const providersData = providersResponse.data as ProvidersData
    const usRegion = providersData.results?.US
    if (usRegion && (usRegion.flatrate?.length || usRegion.rent?.length || usRegion.buy?.length)) {
      amazonPrimeUrl = usRegion.link ?? null
    }
  } catch (err) {
    logger.error({ logId: 'blunt-searching-prime', err, mediaId: id }, 'Failed to fetch TMDb watch providers for Amazon lookup')
    res.status(500).json({ error: 'Internal server error' })
    return
  }

  if (!amazonPrimeUrl) {
    logger.info({ logId: 'calm-missing-prime', mediaId: id }, 'Not found on streaming services in the US')
    res.json({ amazonPrimeUrl: null, message: 'Not found on streaming services in the US.' })
    return
  }

  try {
    await prisma.media.update({ where: { id }, data: { amazonPrimeUrl } })
  } catch (err) {
    logger.error({ logId: 'dark-saving-prime', err, mediaId: id }, 'Failed to save Amazon Prime URL')
    res.status(500).json({ error: 'Internal server error' })
    return
  }
  logger.info({ logId: 'keen-saving-prime', mediaId: id, amazonPrimeUrl }, 'Amazon Prime URL saved')
  res.json({ amazonPrimeUrl })
})

// PATCH /api/media/:id/amazon-prime-url
router.patch('/:id/amazon-prime-url', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  const { amazonPrimeUrl } = req.body as { amazonPrimeUrl?: string | null }

  let media: { id: string } | null
  try {
    media = await prisma.media.findUnique({ where: { id }, select: { id: true } })
  } catch (err) {
    logger.error({ logId: 'pale-seeking-prime', err, mediaId: id }, 'Failed to fetch media for amazon-prime-url patch')
    res.status(500).json({ error: 'Internal server error' })
    return
  }
  if (!media) {
    res.status(404).json({ error: 'Media not found' })
    return
  }

  try {
    const updated = await prisma.media.update({
      where: { id },
      data: { amazonPrimeUrl: amazonPrimeUrl ?? null },
      select: { id: true, amazonPrimeUrl: true },
    })
    logger.info({ logId: 'bold-setting-prime', mediaId: id }, 'Amazon Prime URL updated')
    res.json(updated)
  } catch (err) {
    logger.error({ logId: 'dark-patching-prime', err, mediaId: id }, 'Failed to update Amazon Prime URL')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/media/:id/trailer-lookup
router.post('/:id/trailer-lookup', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params

  let media: { id: string; title: string; releaseYear: number | null; mediaType: string } | null
  try {
    media = await prisma.media.findUnique({
      where: { id },
      select: { id: true, title: true, releaseYear: true, mediaType: true },
    })
  } catch (err) {
    logger.error({ logId: 'thin-seeking-reel', err, mediaId: id }, 'Failed to fetch media for trailer lookup')
    res.status(500).json({ error: 'Internal server error' })
    return
  }
  if (!media) {
    res.status(404).json({ error: 'Media not found' })
    return
  }

  let tmdbId: number
  try {
    tmdbId = await getTmdbId({ title: media.title, releaseYear: media.releaseYear, mediaType: media.mediaType as MediaType })
  } catch (err) {
    logger.error({ logId: 'pale-seeking-tmdb-reel', err, mediaId: id }, 'Failed to get TMDb ID for trailer lookup')
    res.status(422).json({ error: 'Title not found on TMDb.' })
    return
  }

  let trailerUrl: string | null = null
  try {
    const endpoint = media.mediaType === 'SHOW'
      ? `https://api.themoviedb.org/3/tv/${tmdbId}/videos`
      : `https://api.themoviedb.org/3/movie/${tmdbId}/videos`
    const tmdbToken = process.env['TMDB_READ_ACCESS_TOKEN']
    const videosResponse = await axios.get(endpoint, {
      headers: { Authorization: `Bearer ${tmdbToken}` },
      timeout: 15000,
    })
    type VideoResult = { site: string; type: string; key: string }
    type VideosData = { results?: VideoResult[] }
    const videosData = videosResponse.data as VideosData
    const trailer = (videosData.results ?? []).find(v => v.site === 'YouTube' && v.type === 'Trailer')
    if (trailer) {
      trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`
    }
  } catch (err) {
    logger.error({ logId: 'pale-searching-reel', err, mediaId: id }, 'Failed to fetch TMDb videos for trailer lookup')
    res.status(500).json({ error: 'Internal server error' })
    return
  }

  if (!trailerUrl) {
    logger.info({ logId: 'soft-missing-reel', mediaId: id }, 'No trailer found')
    res.json({ trailerUrl: null, message: 'No trailer found.' })
    return
  }

  try {
    await prisma.media.update({ where: { id }, data: { trailerUrl } })
  } catch (err) {
    logger.error({ logId: 'dark-saving-reel', err, mediaId: id }, 'Failed to save trailer URL')
    res.status(500).json({ error: 'Internal server error' })
    return
  }
  logger.info({ logId: 'clear-saving-reel', mediaId: id, trailerUrl }, 'Trailer URL saved')
  res.json({ trailerUrl })
})

const CAST_SORT_ORDER_VALUES = ['BY_ACTOR', 'BY_ROLE', 'CUSTOM'] as const
type CastSortOrderValue = (typeof CAST_SORT_ORDER_VALUES)[number]

// PUT /api/media/:id/cast-sort
router.put('/:id/cast-sort', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  const { castSortOrder } = req.body as { castSortOrder?: unknown }

  if (!castSortOrder || !(CAST_SORT_ORDER_VALUES as readonly unknown[]).includes(castSortOrder)) {
    res.status(400).json({ error: `Invalid castSortOrder. Must be one of: ${CAST_SORT_ORDER_VALUES.join(', ')}` })
    return
  }

  try {
    const media = await prisma.media.findUnique({ where: { id }, select: { id: true } })
    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    const updated = await prisma.media.update({
      where: { id },
      data: { castSortOrder: castSortOrder as CastSortOrderValue },
      select: { castSortOrder: true },
    })

    logger.info({ logId: 'swift-setting-rank', mediaId: id, castSortOrder }, 'Cast sort order updated')
    res.json({ castSortOrder: updated.castSortOrder })
  } catch (err) {
    logger.error({ logId: 'dark-setting-rank', err, mediaId: id }, 'Failed to update cast sort order')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/media/:id/cast-reorder
router.put('/:id/cast-reorder', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  const { order } = req.body as { order?: unknown }

  if (!Array.isArray(order) || order.length === 0) {
    res.status(400).json({ error: 'Body must include a non-empty "order" array' })
    return
  }

  for (const item of order) {
    if (
      typeof item !== 'object' || item === null ||
      typeof (item as Record<string, unknown>)['id'] !== 'string' ||
      typeof (item as Record<string, unknown>)['billingOrder'] !== 'number'
    ) {
      res.status(400).json({ error: 'Each item in "order" must have a string "id" and a number "billingOrder"' })
      return
    }
  }

  const orderItems = order as Array<{ id: string; billingOrder: number }>

  try {
    const media = await prisma.media.findUnique({ where: { id }, select: { id: true } })
    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    const existingRoles = await prisma.castRole.findMany({
      where: { mediaId: id },
      select: { id: true },
    })
    const existingIds = new Set(existingRoles.map(r => r.id))

    for (const item of orderItems) {
      if (!existingIds.has(item.id)) {
        logger.warn({ logId: 'pale-rejecting-rank', mediaId: id, castRoleId: item.id }, 'Cast role id does not belong to this media')
        res.status(400).json({ error: `Cast role id "${item.id}" does not belong to this media` })
        return
      }
    }

    await prisma.$transaction(
      orderItems.map(item =>
        prisma.castRole.update({
          where: { id: item.id },
          data: { billingOrder: item.billingOrder },
        })
      )
    )

    logger.info({ logId: 'keen-sorting-rank', mediaId: id, updated: orderItems.length }, 'Cast billing order updated')
    res.json({ updated: orderItems.length })
  } catch (err) {
    logger.error({ logId: 'grim-sorting-rank', err, mediaId: id }, 'Failed to reorder cast')
    res.status(500).json({ error: 'Internal server error' })
  }
})

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2025'
  )
}

export default router
