import axios from 'axios'

export type MediaType = 'MOVIE' | 'SHOW'

export async function getTmdbId(media: {
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
