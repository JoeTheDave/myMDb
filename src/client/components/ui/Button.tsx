import { FC } from 'react'
import { ReactComponentProps } from '@/client/lib/types'
import clsx from 'clsx'

export interface ButtonProps extends ReactComponentProps {
  id: string
  onClick?: () => void
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'accent' | 'ghost' | 'default'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  outline?: boolean
  disabled?: boolean
  submit?: boolean
}

export const Button: FC<ButtonProps> = ({
  id,
  color = 'default',
  children,
  onClick,
  outline,
  size = 'md',
  disabled,
  submit,
}) => {
  return (
    <button
      id={id}
      name={id}
      type={submit ? 'submit' : 'button'}
      onClick={onClick}
      disabled={disabled}
      className={clsx('btn', 'btn-', {
        'btn-primary': color === 'primary',
        'btn-secondary': color === 'secondary',
        'btn-success': color === 'success',
        'btn-error': color === 'error',
        'btn-warning': color === 'warning',
        'btn-info': color === 'info',
        'btn-accent': color === 'accent',
        'btn-ghost': color === 'ghost',
        'btn-outline': outline,
        'btn-xs': size === 'xs',
        'btn-sm': size === 'sm',
        'btn-lg': size === 'lg',
      })}
    >
      {children}
    </button>
  )
}
