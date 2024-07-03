import { FC, useRef, useState, useCallback } from 'react'
import { ReactComponentProps } from '@/client/lib/types'
import { FolderUp, Earth, X } from 'lucide-react'
import { fileToBase64 } from '@/shared/utils'
import genericActorImg from '@/client/assets/generic-actor.jpg'
import genericMovieImg from '@/client/assets/generic-movie.jpg'
import api from '@/client/lib/api'
import clsx from 'clsx'

export interface ImageSelectionProps extends ReactComponentProps {
  type: 'movie' | 'actor'
  id: string
  name: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  value?: string
}

const genericImg = {
  movie: genericMovieImg,
  actor: genericActorImg,
}

export const ImageSelection: FC<ImageSelectionProps> = ({ id, name, type, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedImg, setSelectedImg] = useState<string | null>(null)

  const handleFileChange = useCallback(
    (value: string) => {
      if (onChange) {
        const e = new Event('change', { bubbles: true }) as unknown as React.ChangeEvent<HTMLInputElement>
        onChange({
          ...e,
          target: {
            ...e.target,
            name,
            value,
          },
        })
      }
    },
    [onChange],
  )

  return (
    <div
      id={id}
      className="bg-slate-300 border border-slate-400 w-[200px] h-[300px] rounded-lg relative overflow-hidden"
    >
      <img
        src={selectedImg ? selectedImg : genericImg[type]}
        className={clsx('h-full object-cover', { 'opacity-20': !selectedImg })}
      />

      <div className="flex items-center justify-around h-[60px] w-full absolute bottom-[15px] opacity-50">
        <button
          type="button"
          className="btn btn-circle"
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.click()
            }
          }}
        >
          <FolderUp size={20} />
        </button>

        {selectedImg && (
          <button
            type="button"
            className="btn btn-circle"
            onClick={() => {
              setSelectedImg(null)
              handleFileChange('')
            }}
          >
            <X size={20} />
          </button>
        )}

        <button type="button" className="btn btn-circle">
          <Earth size={20} />
        </button>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="display-none"
        onChange={async e => {
          if (e.target.files && e.target.files[0]) {
            const fileBase64 = ((await fileToBase64(e.target.files[0])) as string).split(',')[1]
            const response = await api.preProcessImage(fileBase64)
            if (response.success) {
              setSelectedImg(`data:image/jpeg;base64,${response.data.processedFile}`)
              handleFileChange(response.data.processedFile)
            } else {
              console.log('error processing image')
            }
          }
        }}
      />
    </div>
  )
}
