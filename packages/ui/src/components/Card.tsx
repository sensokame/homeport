import type { ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps {
  status?: 'ok' | 'warn' | 'error'
  onClick?: () => void
  className?: string
  children: ReactNode
}

export function Card({ status, onClick, className, children }: CardProps) {
  const cls = [
    styles.card,
    onClick ? styles.clickable : '',
    status ? styles[status] : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {children}
    </div>
  )
}
