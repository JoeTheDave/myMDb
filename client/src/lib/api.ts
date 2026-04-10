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
  update: (id: string, data: Partial<MediaFormData>) =>
    apiFetch<MediaDetail>('/api/media/' + id, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }),
  delete: (id: string) => apiFetch<void>('/api/media/' + id, { method: 'DELETE' }),
  rate: (id: string, stars: number) =>
    apiFetch<void>('/api/media/' + id + '/ratings', {
      method: 'PUT',
      body: JSON.stringify({ stars }),
      headers: { 'Content-Type': 'application/json' },
    }),
  deleteRating: (id: string) => apiFetch<void>('/api/media/' + id + '/ratings', { method: 'DELETE' }),
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
