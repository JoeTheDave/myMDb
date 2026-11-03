import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { app } from '../../index'
import { clearExploreCaches } from '../../routes/explore'
import { createUser, makeToken, createActor, createCastRole } from '../helpers'

vi.mock('axios')
import axios from 'axios'
const mockAxiosGet = vi.mocked(axios.get)

vi.mock('../../lib/s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/s3')>()
  return {
    ...actual,
    uploadBufferToS3: vi.fn().mockResolvedValue('https://mock-bucket.s3.us-east-1.amazonaws.com/poster.jpg'),
  }
})

const databaseUrl = process.env['DATABASE_URL']
const prisma = new PrismaClient(
  databaseUrl !== undefined ? { datasources: { db: { url: databaseUrl } } } : undefined,
)

function credit(overrides: Record<string, unknown>) {
  return {
    id: 1,
    media_type: 'movie',
    title: 'Some Movie',
    release_date: '2010-05-01',
    poster_path: '/p.jpg',
    popularity: 10,
    vote_count: 500,
    genre_ids: [18],
    character: 'Hero',
    ...overrides,
  }
}

async function editorAuth() {
  const editor = await createUser({ role: 'EDITOR' })
  return `token=${makeToken({ id: editor.id, email: editor.email, role: editor.role })}`
}

beforeEach(async () => {
  await prisma.exploreDismissal.deleteMany()
  clearExploreCaches()
  mockAxiosGet.mockReset()
})

describe('GET /api/explore', () => {
  it('requires EDITOR', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const res = await request(app)
      .get('/api/explore')
      .set('Cookie', `token=${makeToken({ id: viewer.id, email: viewer.email, role: viewer.role })}`)
    expect(res.status).toBe(403)
  })

  it('lists unseen titles, ranked by shared actors, filtering existing, dismissed and junk', async () => {
    const cookie = await editorAuth()
    const a1 = await prisma.actor.create({ data: { name: 'Alice', tmdbPersonId: 11 } })
    const a2 = await prisma.actor.create({ data: { name: 'Bob', tmdbPersonId: 22 } })
    await prisma.media.create({ data: { title: 'Already Here', releaseYear: 2001 } })
    await prisma.exploreDismissal.create({ data: { tmdbId: 300, mediaType: 'MOVIE' } })

    mockAxiosGet.mockImplementation(async (url: string) => {
      if (url.includes('/person/11/')) {
        return { data: { cast: [
          credit({ id: 100, title: 'Shared Film', popularity: 1 }),
          credit({ id: 200, title: 'Popular Solo', popularity: 99 }),
          credit({ id: 300, title: 'Dismissed' }),
          credit({ id: 400, title: 'Already Here', release_date: '2001-01-01' }),
          credit({ id: 500, title: 'Talk Show', media_type: 'tv', name: 'Talk Show', first_air_date: '2000-01-01', genre_ids: [10767] }),
          credit({ id: 600, title: 'Cameo', character: 'Herself' }),
          credit({ id: 700, title: 'Obscure', vote_count: 3 }),
          credit({ id: 800, title: 'Upcoming', release_date: '2999-01-01' }),
        ] } }
      }
      if (url.includes('/person/22/')) {
        return { data: { cast: [credit({ id: 100, title: 'Shared Film', character: 'Sidekick', popularity: 1 })] } }
      }
      throw new Error(`unexpected ${url}`)
    })

    const res = await request(app).get('/api/explore').set('Cookie', cookie)
    expect(res.status).toBe(200)
    const titles = (res.body.items as Array<{ title: string }>).map(i => i.title)
    expect(titles).toEqual(['Shared Film', 'Popular Solo'])
    expect(res.body.items[0].actors.map((a: { id: string }) => a.id).sort()).toEqual([a1.id, a2.id].sort())
    expect(res.body.items[0].posterUrl).toBe('https://image.tmdb.org/t/p/w342/p.jpg')
  })

  it('backfills missing tmdbPersonId from the credits of media the actor is in', async () => {
    const cookie = await editorAuth()
    const media = await prisma.media.create({ data: { title: 'Known', tmdbId: 55 } })
    const actor = await createActor({ name: 'Zoë Saldaña' })
    await createCastRole(media.id, actor.id)

    mockAxiosGet.mockImplementation(async (url: string) => {
      if (url.endsWith('/movie/55/credits')) return { data: { cast: [{ id: 77, name: 'Zoë Saldaña' }] } }
      if (url.includes('/person/77/')) return { data: { cast: [credit({ id: 900, title: 'Found Via Backfill' })] } }
      throw new Error(`unexpected ${url}`)
    })

    const res = await request(app).get('/api/explore').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.items.map((i: { title: string }) => i.title)).toEqual(['Found Via Backfill'])
    const updated = await prisma.actor.findUnique({ where: { id: actor.id } })
    expect(updated?.tmdbPersonId).toBe(77)
  })
})

describe('POST /api/explore/dismiss', () => {
  it('records the dismissal idempotently', async () => {
    const cookie = await editorAuth()
    for (let i = 0; i < 2; i++) {
      const res = await request(app).post('/api/explore/dismiss').set('Cookie', cookie).send({ tmdbId: 42, mediaType: 'SHOW', title: 'X' })
      expect(res.status).toBe(204)
    }
    expect(await prisma.exploreDismissal.count({ where: { tmdbId: 42, mediaType: 'SHOW' } })).toBe(1)
  })

  it('rejects a bad body', async () => {
    const cookie = await editorAuth()
    const res = await request(app).post('/api/explore/dismiss').set('Cookie', cookie).send({ tmdbId: 'x' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/explore/add', () => {
  it('creates a movie from TMDb details with poster, imdbId and rating', async () => {
    const cookie = await editorAuth()
    mockAxiosGet.mockImplementation(async (url: string) => {
      if (url.endsWith('/movie/123')) {
        return { data: {
          title: 'New Film', release_date: '2015-07-04', imdb_id: 'tt123', poster_path: '/np.jpg',
          release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ type: 3, certification: 'PG-13' }] }] },
        } }
      }
      if (url.includes('image.tmdb.org')) return { data: new ArrayBuffer(4) }
      throw new Error(`unexpected ${url}`)
    })

    const res = await request(app).post('/api/explore/add').set('Cookie', cookie).send({ tmdbId: 123, mediaType: 'MOVIE' })
    expect(res.status).toBe(201)
    const media = await prisma.media.findUnique({ where: { id: res.body.id } })
    expect(media).toMatchObject({
      title: 'New Film', releaseYear: 2015, imdbId: 'tt123', tmdbId: 123, contentRating: 'PG_13',
      imageUrl: 'https://mock-bucket.s3.us-east-1.amazonaws.com/poster.jpg',
    })

    const again = await request(app).post('/api/explore/add').set('Cookie', cookie).send({ tmdbId: 123, mediaType: 'MOVIE' })
    expect(again.status).toBe(409)
  })

  it('creates a show with US TV rating and external imdb id', async () => {
    const cookie = await editorAuth()
    mockAxiosGet.mockImplementation(async (url: string) => {
      if (url.endsWith('/tv/9')) {
        return { data: {
          name: 'New Show', first_air_date: '2019-01-01', poster_path: null,
          external_ids: { imdb_id: 'tt9' }, content_ratings: { results: [{ iso_3166_1: 'US', rating: 'TV-MA' }] },
        } }
      }
      throw new Error(`unexpected ${url}`)
    })
    const res = await request(app).post('/api/explore/add').set('Cookie', cookie).send({ tmdbId: 9, mediaType: 'SHOW' })
    expect(res.status).toBe(201)
    const media = await prisma.media.findUnique({ where: { id: res.body.id } })
    expect(media).toMatchObject({ title: 'New Show', mediaType: 'SHOW', contentRating: 'TV_MA', imdbId: 'tt9', imageUrl: null })
  })
})

