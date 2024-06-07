import { FC } from 'react'
import { ReactComponentProps } from '@/client/lib/types'
import clsx from 'clsx'

export interface TextBoxProps extends ReactComponentProps {
  id: string
  label: string
  labelTopRight?: string
  labelBottomRight?: string
  error?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'accent' | 'default'
  password?: boolean
  watermark?: string
  iconPrefix?: JSX.Element | JSX.Element[]
  iconSuffix?: JSX.Element | JSX.Element[]
}

export const TextBox: FC<TextBoxProps> = ({
  id,
  label,
  labelTopRight,
  labelBottomRight,
  error,
  size = 'md',
  disabled,
  color = 'default',
  password,
  watermark,
  iconPrefix,
  iconSuffix,
}) => {
  return (
    <label className="form-control w-full py-1">
      <div className="label py-0">
        <span className="label-text">{label}</span>
        <span className="label-text-alt">{labelTopRight}</span>
      </div>

      <label
        className={clsx('input', 'input-bordered', 'flex', 'items-center', 'gap-2', {
          'input-xs': size === 'xs',
          'input-sm': size === 'sm',
          'input-md': size === 'md',
          'input-lg': size === 'lg',
          'input-primary': color === 'primary' && !error,
          'input-secondary': color === 'secondary' && !error,
          'input-success': color === 'success' && !error,
          'input-error': color === 'error' || error,
          'input-warning': color === 'warning' && !error,
          'input-info': color === 'info' && !error,
          'input-accent': color === 'accent' && !error,
        })}
      >
        {iconPrefix}
        <input
          id={id}
          name={id}
          type={password ? 'password' : 'text'}
          placeholder={watermark}
          className="grow"
          disabled={disabled}
        />
        {iconSuffix}
      </label>

      <div className="label py-0 h-[15px]">
        <span className="label-text-alt text-error">{error}</span>
        <span className="label-text-alt">{labelBottomRight}</span>
      </div>
    </label>
  )
}
