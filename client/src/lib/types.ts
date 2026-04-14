export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER'

export type CastSortOrder = 'BY_ACTOR' | 'BY_ROLE' | 'CUSTOM'

export type MediaType = 'MOVIE' | 'SHOW'

export type ContentRating =
  | 'G'
  | 'PG'
  | 'PG_13'
  | 'R'
  | 'NC_17'
  | 'NR'
  | 'TV_Y'
  | 'TV_Y7'
  | 'TV_G'
  | 'TV_PG'
  | 'TV_14'
  | 'TV_MA'

export interface User {
  id: string
  email: string
  name?: string
  imageUrl?: string
  role: Role
  active: boolean
}

export interface MediaListItem {
  id: string
  title: string
  imageUrl?: string
  mediaType: MediaType
  contentRating?: ContentRating
  releaseYear?: number
  criticRating: number | null
  audienceRating: number | null
}

export interface MediaListResponse {
  items: MediaListItem[]
  total: number
  page: number
  totalPages: number
}

export interface CastMemberDetail {
  id: string
  characterName: string | null
  roleImageUrl?: string
  roleImageFocalX?: number | null
  roleImageFocalY?: number | null
  billingOrder: number
  actor: {
    id: string
    name: string
    imageUrl?: string
    imageFocalX?: number | null
    imageFocalY?: number | null
  }
}

export interface MediaDetail {
  id: string
  title: string
  imageUrl?: string
  mediaType: MediaType
  contentRating?: ContentRating
  releaseYear?: number
  cast: CastMemberDetail[]
  castSortOrder: CastSortOrder
  criticRating: number | null
  audienceRating: number | null
  amazonPrimeUrl: string | null
  trailerUrl: string | null
}

export interface ActorListItem {
  id: string
  name: string
  imageUrl?: string
  imageFocalX?: number | null
  imageFocalY?: number | null
  birthday?: string
  deathDay?: string
}

export interface ActorListResponse {
  items: ActorListItem[]
  total: number
  page: number
  totalPages: number
}

export interface ActorFilmographyItem {
  castRoleId: string
  id: string
  title: string
  imageUrl?: string
  mediaType: MediaType
  releaseYear?: number
  characterName: string | null
  roleImageUrl?: string
  roleImageFocalX?: number | null
  roleImageFocalY?: number | null
}

export interface ActorDetail {
  id: string
  name: string
  imageUrl?: string
  imageFocalX?: number | null
  imageFocalY?: number | null
  birthday?: string
  deathDay?: string
  bio?: string
  filmography: ActorFilmographyItem[]
}

export interface CastRole {
  id: string
  characterName: string
  roleImageUrl?: string
  roleImageFocalX?: number | null
  roleImageFocalY?: number | null
  actorId: string
  mediaId: string
}

export interface MediaListParams {
  q?: string | undefined
  type?: MediaType | 'ALL' | undefined
  contentRating?: string | undefined
  yearFrom?: number | undefined
  yearTo?: number | undefined
  minRating?: number | undefined
  actorId?: string | undefined
  page?: number | undefined
  limit?: number | undefined
}

export interface ActorListParams {
  q?: string | undefined
  birthYearFrom?: number | undefined
  birthYearTo?: number | undefined
  deceased?: boolean | undefined
  mediaId?: string | undefined
  page?: number | undefined
  limit?: number | undefined
}

export interface MediaFormData {
  title: string
  mediaType: MediaType
  imageUrl?: string | undefined
  releaseYear?: number | undefined
  contentRating?: ContentRating | undefined
}

export interface ActorFormData {
  name: string
  imageUrl?: string | undefined
  imageFocalX?: number | null | undefined
  imageFocalY?: number | null | undefined
  birthday?: string | undefined
  deathDay?: string | undefined
}

export interface CastRoleFormData {
  actorId: string
  characterName?: string | undefined
  roleImageUrl?: string | null | undefined
  roleImageFocalX?: number | null | undefined
  roleImageFocalY?: number | null | undefined
}

export const MOVIE_RATINGS: ContentRating[] = ['G', 'PG', 'PG_13', 'R', 'NC_17', 'NR']
export const TV_RATINGS: ContentRating[] = ['TV_Y', 'TV_Y7', 'TV_G', 'TV_PG', 'TV_14', 'TV_MA']

export function formatContentRating(rating: ContentRating): string {
  const map: Record<ContentRating, string> = {
    G: 'G',
    PG: 'PG',
    PG_13: 'PG-13',
    R: 'R',
    NC_17: 'NC-17',
    NR: 'NR',
    TV_Y: 'TV-Y',
    TV_Y7: 'TV-Y7',
    TV_G: 'TV-G',
    TV_PG: 'TV-PG',
    TV_14: 'TV-14',
    TV_MA: 'TV-MA',
  }
  return map[rating]
}

export function roleHierarchy(role: Role): number {
  switch (role) {
    case 'ADMIN':
      return 3
    case 'EDITOR':
      return 2
    case 'VIEWER':
      return 1
  }
}

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return roleHierarchy(userRole) >= roleHierarchy(minRole)
}
