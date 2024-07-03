import { Movie } from '@/shared/types'

const get = async (url: string) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  if (response.status === 200) {
    const data = await response.json()
    return data
  } else {
    console.log(`error: status code ${response.status}`)
    // TODO: error toast
  }
}

const post = async (url: string, body: object) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (response.status === 200) {
    const data = await response.json()
    return data
  } else {
    console.log(`error: status code ${response.status}`)
    // TODO: error toast
  }
}

const createAccount = async (email: string, password: string) =>
  await post('/api/create-account', {
    email,
    password,
  })

const login = async (email: string, password: string) =>
  await post('/api/login', {
    email,
    password,
  })

const logout = async () => await post('/api/logout', {})

const preProcessImage = async (file: string) => await post('/api/pre-process-img', { file })

const saveMovie = async (movie: Movie) => await post('/api/save-movie', movie)

const api = {
  createAccount,
  login,
  logout,
  preProcessImage,
  saveMovie,
}

export default api
