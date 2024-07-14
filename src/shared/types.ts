export interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
}

export class Movie {
  id: string
  movieName: string
  releaseYear: string
  tempImage: string
  movieImage: string
  movieThumbnail: string
  mpaRating: string

  constructor() {
    this.id = ''
    this.movieName = ''
    this.releaseYear = ''
    this.tempImage = ''
    this.movieImage = ''
    this.movieThumbnail = ''
    this.mpaRating = ''
  }
}
