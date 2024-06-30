import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { appConstants } from '@/shared/utils'
import { AppUserIdentity } from '@/server/lib/types'

export const useAppUser = () => {
  const decodedCookie = decodeURIComponent(document.cookie)
  const cookiesArray = decodedCookie.split(';')
  const appUserCookie = cookiesArray.find(cookie => cookie.includes(`${appConstants.cookies.appUserIdentity}=`)) || ''
  if (appUserCookie) {
    const appUser = JSON.parse(appUserCookie.replace(`${appConstants.cookies.appUserIdentity}=j:`, '') || '')
    return appUser as AppUserIdentity
  } else {
    return {
      user: 'anonymouse',
      role: 'viewer',
      loggedIn: false,
    } as AppUserIdentity
  }
}

export const useAuthRedirect = () => {
  const navigate = useNavigate()
  const appUser = useAppUser()
  useEffect(() => {
    if (appUser.loggedIn) {
      navigate('/')
    }
  }, [appUser])
}
