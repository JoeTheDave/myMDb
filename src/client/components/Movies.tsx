import { FC, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReactComponentProps } from '@/client/lib/types'
import { useAppUser } from '@/client/lib/authorizationHooks'

export interface MoviesProps extends ReactComponentProps {}

export const Movies: FC<MoviesProps> = () => {
  const appUser = useAppUser()
  const navigate = useNavigate()
  useEffect(() => {
    if (window.location.pathname === '/') {
      navigate('/movies')
    }
  }, [window.location.pathname])

  return (
    <div className="w-full h-full bg-slate-200">
      <div>{`User: ${appUser.user}`}</div>
      <div>{`Role: ${appUser.role}`}</div>
      <div>{`Logged In: ${appUser.loggedIn}`}</div>
    </div>
  )
}
