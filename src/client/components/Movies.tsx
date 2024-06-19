import { FC } from 'react'
import { ReactComponentProps } from '@/client/lib/types'
import { useAppUser } from '@/client/lib/authorizationHooks'

export interface MoviesProps extends ReactComponentProps {}

export const Movies: FC<MoviesProps> = () => {
  const appUser = useAppUser()
  return (
    <div className="w-full h-full bg-slate-200">
      <div>{`User: ${appUser.user}`}</div>
      <div>{`Role: ${appUser.role}`}</div>
      <div>{`Logged In: ${appUser.loggedIn}`}</div>
    </div>
  )
}
