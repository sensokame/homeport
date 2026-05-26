import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost'
  size?: 'default' | 'sm'
}

export function Button({ variant = 'primary', size = 'default', className, ...props }: ButtonProps) {
  const cls = [
    styles.btn,
    styles[variant],
    size === 'sm' ? styles.sm : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return <button className={cls} {...props} />
}
