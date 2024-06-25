import { FC } from 'react'
import { ReactComponentProps } from '@/client/lib/types'
import moviePoster from '@/client/assets/temp-movie-poster.png'
import { useAuthRedirect } from '@/client/lib/authorizationHooks'

export interface AuthContainerProps extends ReactComponentProps {
  header: string
  buttons: string | JSX.Element | JSX.Element[]
  submitAction: () => void
}

export const AuthContainer: FC<AuthContainerProps> = ({ header, children, buttons, submitAction }) => {
  useAuthRedirect()
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        id="auth-container"
        className="border border-gray-300 rounded-[20px] w-[1000px] h-[500px] flex overflow-hidden shadow-xl"
      >
        <div style={{ backgroundImage: `url(${moviePoster})` }} className="w-[400px] h-full bg-cover bg-center"></div>
        <form
          onSubmit={e => {
            e.preventDefault()
            submitAction()
          }}
          className="flex flex-col justify-between flex-1 bg-slate-100 p-5"
        >
          <div className="font-PermanentMarker text-[30px]">{header}</div>
          <div className="">{children}</div>
          <div className="">{buttons}</div>
        </form>
      </div>
    </div>
  )
}
