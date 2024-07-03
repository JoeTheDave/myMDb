export const validateEmail = (email: string) => {
  const valid = !!email
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    )
  if (!valid) {
    return email ? 'Invalid Email' : 'Email is required'
  }
  return ''
}

export const validatePassword = (password: string) => {
  if (password.length < 8 || password.length > 32) {
    if (password.length === 0) {
      return 'Password is required.'
    }
    return 'Password must have length in range of 8 - 32 characters.'
  }
  return ''
}

export const appConstants = {
  cookies: {
    authorization: 'authorization',
    appUserIdentity: 'app-user-identity',
  },
}

export const fileToBase64 = (file: File) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = error => reject(error)
  })
}
