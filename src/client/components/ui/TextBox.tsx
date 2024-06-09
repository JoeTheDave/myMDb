import { FC } from 'react'
import { ReactComponentProps } from '@/client/lib/types'
import clsx from 'clsx'

export interface TextBoxProps extends ReactComponentProps {
  autoFocus?: boolean
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'accent' | 'default'
  disabled?: boolean
  error?: string
  iconPrefix?: JSX.Element | JSX.Element[]
  iconSuffix?: JSX.Element | JSX.Element[]
  id: string
  label: string
  labelBottomRight?: string
  labelTopRight?: string
  name: string
  onBlur?: () => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  password?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  value?: string
  watermark?: string
}

export const TextBox: FC<TextBoxProps> = ({
  autoFocus,
  color = 'default',
  disabled,
  error,
  iconPrefix,
  iconSuffix,
  id,
  label,
  labelBottomRight,
  labelTopRight,
  name,
  onBlur,
  onChange,
  password,
  size = 'md',
  value,
  watermark,
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
          autoFocus={autoFocus}
          className="grow"
          disabled={disabled}
          id={id}
          name={name}
          onBlur={onBlur}
          onChange={onChange}
          placeholder={watermark}
          type={password ? 'password' : 'text'}
          value={value}
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
