import { FC } from 'react'
import { ReactComponentProps } from '@/client/lib/types'
import moviePoster from '@/client/assets/temp-movie-poster.png'

export interface AuthContainerProps extends ReactComponentProps {}

export const AuthContainer: FC<AuthContainerProps> = ({ children }) => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        id="auth-container"
        className="border border-gray-300 rounded-[20px] w-[1000px] h-[600px] flex overflow-hidden shadow-xl"
      >
        <div style={{ backgroundImage: `url(${moviePoster})` }} className="w-[400px] h-full bg-cover bg-center"></div>
        <div className="flex-1 bg-slate-100 p-5">{children}</div>
      </div>
    </div>
  )
}
