import { FC } from 'react'
import { ReactComponentProps } from '@/client/lib/types'
import moviePoster from '@/client/assets/temp-movie-poster.png'

export interface TextBoxProps extends ReactComponentProps {
  id: string
  label: string
  labelTopRight?: string
  labelBottomRight?: string
  error?: string
}

export const TextBox: FC<TextBoxProps> = ({ id, label, labelTopRight, labelBottomRight, error }) => {
  return (
    <label className="form-control w-full py-1 h-[95px]">
      <div className="label py-0">
        <span className="label-text">{label}</span>
        <span className="label-text-alt">{labelTopRight}</span>
      </div>
      <input id={id} name={id} type="text" placeholder="Type here" className="input input-bordered w-full" />
      <div className="label py-0">
        <span className="label-text-alt text-error">{error}</span>
        <span className="label-text-alt">{labelBottomRight}</span>
      </div>
    </label>
  )
}
