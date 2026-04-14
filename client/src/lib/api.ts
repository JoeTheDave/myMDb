import type {
  User,
  MediaListItem,
  MediaListResponse,
  MediaDetail,
  ActorListItem,
  ActorListResponse,
  ActorDetail,
  CastRole,
  MediaListParams,
  ActorListParams,
  MediaFormData,
  ActorFormData,
  CastRoleFormData,
  CastSortOrder,
} from './types'

export type {
  User,
  MediaListItem,
  MediaListResponse,
  MediaDetail,
  ActorListItem,
  ActorListResponse,
  ActorDetail,
  CastRole,
  MediaListParams,
  ActorListParams,
  MediaFormData,
  ActorFormData,
  CastRoleFormData,
  CastSortOrder,
}

const BASE_URL: string = import.meta.env['VITE_API_URL'] ?? ''

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export { ApiError }

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
  })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { message?: unknown; error?: unknown }
      const raw = body.message ?? body.error
      if (typeof raw === 'string') {
        message = raw
      } else if (raw != null) {
        message = JSON.stringify(raw)
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  return res.json() as Promise<T>
}

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  return search.toString()
}

export const authApi = {
  me: () => apiFetch<User>('/api/auth/me'),
  logout: () => apiFetch<void>('/api/auth/logout', { method: 'POST' }),
}

export const mediaApi = {
  list: (params: MediaListParams) =>
    apiFetch<MediaListResponse>('/api/media?' + toQueryString(params as Record<string, unknown>)),
  get: (id: string) => apiFetch<MediaDetail>('/api/media/' + id),
  create: (data: MediaFormData) =>
    apiFetch<MediaDetail>('/api/media', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }),
  update: (id: string, data: Omit<Partial<MediaFormData>, 'imageUrl'> & { imageUrl?: string | null | undefined }) =>
    apiFetch<MediaDetail>('/api/media/' + id, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }),
  delete: (id: string) => apiFetch<void>('/api/media/' + id, { method: 'DELETE' }),
  fetchRatings: (id: string) =>
    apiFetch<{ criticRating: number | null; audienceRating: number | null }>('/api/media/' + id + '/fetch-ratings', { method: 'PATCH' }),
  importCast: (id: string, imdbId: string) =>
    apiFetch<{ imported: number; matched: number; created: number; skipped: number }>('/api/media/' + id + '/cast/import', {
      method: 'POST',
      body: JSON.stringify({ imdbId }),
      headers: { 'Content-Type': 'application/json' },
    }),
  updateAmazonPrimeUrl: (id: string, amazonPrimeUrl: string | null) =>
    apiFetch<{ amazonPrimeUrl: string | null }>('/api/media/' + id + '/amazon-prime-url', {
      method: 'PATCH',
      body: JSON.stringify({ amazonPrimeUrl }),
      headers: { 'Content-Type': 'application/json' },
    }),
  lookupAmazonPrime: (id: string) =>
    apiFetch<{ amazonPrimeUrl: string | null }>('/api/media/' + id + '/amazon-lookup', { method: 'POST' }),
  lookupTrailer: (id: string) =>
    apiFetch<{ trailerUrl: string | null }>('/api/media/' + id + '/trailer-lookup', { method: 'POST' }),
  updateCastSort: (id: string, castSortOrder: CastSortOrder) =>
    apiFetch<{ castSortOrder: CastSortOrder }>('/api/media/' + id + '/cast-sort', {
      method: 'PUT',
      body: JSON.stringify({ castSortOrder }),
      headers: { 'Content-Type': 'application/json' },
    }),
  updateRatings: (id: string, data: { criticRating?: number | null; audienceRating?: number | null }) =>
    apiFetch<{ criticRating: number | null; audienceRating: number | null }>('/api/media/' + id + '/ratings', {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }),
  tmdbLookup: (title: string, year?: number) => {
    const qs = toQueryString({ title, year })
    return apiFetch<{ releaseYear: number | null; contentRating: string | null; imageUrl: string | null; imdbId: string | null }>(
      '/api/media/tmdb-lookup?' + qs,
    )
  },
  purgeNoImageCast: (id: string) =>
    apiFetch<{ deleted: number }>('/api/media/' + id + '/cast/purge-no-image', { method: 'POST' }),
}

export const actorApi = {
  list: (params: ActorListParams) =>
    apiFetch<ActorListResponse>('/api/actors?' + toQueryString(params as Record<string, unknown>)),
  get: (id: string) => apiFetch<ActorDetail>('/api/actors/' + id),
  create: (data: ActorFormData) =>
    apiFetch<ActorDetail>('/api/actors', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }),
  update: (id: string, data: Partial<ActorFormData>) =>
    apiFetch<ActorDetail>('/api/actors/' + id, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }),
  delete: (id: string) => apiFetch<void>('/api/actors/' + id, { method: 'DELETE' }),
  purge: () => apiFetch<{ deleted: number }>('/api/actors/purge', { method: 'DELETE' }),
}

export const castApi = {
  add: (mediaId: string, data: CastRoleFormData) =>
    apiFetch<CastRole>('/api/media/' + mediaId + '/roles', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }),
  update: (id: string, data: Partial<CastRoleFormData>) =>
    apiFetch<CastRole>('/api/roles/' + id, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }),
  delete: (id: string) => apiFetch<void>('/api/roles/' + id, { method: 'DELETE' }),
  reorder: (mediaId: string, order: { id: string; billingOrder: number }[]) =>
    apiFetch<{ updated: number }>('/api/media/' + mediaId + '/cast-reorder', {
      method: 'PUT',
      body: JSON.stringify({ order }),
      headers: { 'Content-Type': 'application/json' },
    }),
}

export const usersApi = {
  list: () => apiFetch<User[]>('/api/users'),
  create: (data: { email: string; role: string }) =>
    apiFetch<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }),
  update: (id: string, data: { role?: string; active?: boolean }) =>
    apiFetch<User>('/api/users/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }),
  delete: (id: string) => apiFetch<void>('/api/users/' + id, { method: 'DELETE' }),
}

export const uploadApi = {
  upload: (file: File, _onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    return apiFetch<{ url: string }>('/api/upload', { method: 'POST', body: form })
  },
}

export const imageApi = {
  searchImages: (query: string, start = 1) =>
    apiFetch<{ results: Array<{ thumbnailUrl: string; fullUrl: string }>; hasMore: boolean }>(
      `/api/images/search?q=${encodeURIComponent(query)}&start=${start}`,
    ),
  downloadImage: (url: string) =>
    apiFetch<{ imageUrl: string }>('/api/images/download', {
      method: 'POST',
      body: JSON.stringify({ url }),
      headers: { 'Content-Type': 'application/json' },
    }),
}
