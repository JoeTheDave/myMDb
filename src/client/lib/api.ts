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
  /////

  const setCookieHeader = response.headers.get('Set-Cookie')
  if (setCookieHeader) {
    console.log('Set-Cookie header exists:', setCookieHeader)
  } else {
    console.log('Set-Cookie header does not exist.')
  }
  /////
  if (response.status === 200) {
    console.log(response.headers)
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

const api = {
  createAccount,
  login,
  logout,
}

export default api
