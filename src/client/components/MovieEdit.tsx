import { FC, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactComponentProps } from '@/client/lib/types'
import { useAppUser } from '@/client/lib/authorizationHooks'
import { TextBox } from '@/client/components/ui/TextBox'
import { ImageSelection } from '@/client/components/ui/ImageSelection'
import { Button } from '@/client/components/ui/Button'
import { Movie } from '@/shared/types'
import api from '../lib/api'

export interface MovieEditProps extends ReactComponentProps {}

export const MovieEdit: FC<MovieEditProps> = () => {
  const { id } = useParams()
  const appUser = useAppUser()
  const navigate = useNavigate()

  const [form, setForm] = useState<Movie>({
    movieName: '',
    releaseYear: '',
    movieImage: '',
    mpaRating: '',
    movieThumbnail: '',
  })

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className="w-full h-full">
      <form>
        <div className="flex">
          <ImageSelection id="movie-image" name="movieImage" type="movie" onChange={onChange} />
          <div className="flex-grow ml-5">
            {id && <h1 className="text-2xl">{`Movie ID: ${id}`}</h1>}
            <TextBox
              id="movie-name"
              name="movieName"
              label="Movie Name"
              value={form.movieName}
              onChange={onChange}
              autoFocus
            />
            <div className="flex gap-2">
              <TextBox
                id="release-year"
                name="releaseYear"
                label="Release Year"
                value={form.releaseYear}
                onChange={onChange}
              />
              <TextBox id="mpa-rating" name="mpaRating" label="MPA Rating" value={form.mpaRating} onChange={onChange} />
            </div>

            <div className="flex justify-end gap-2">
              <Button id="movie-edit-cancel" color="default" size="md">
                Cancel
              </Button>
              <Button
                id="movie-edit-submit"
                color="secondary"
                size="md"
                onClick={async () => {
                  const response = await api.saveMovie(form)
                  console.log(response)
                  if (response.success && response.data.movieId) {
                    navigate('/movies/edit/' + response.data.movieId)
                  }
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
