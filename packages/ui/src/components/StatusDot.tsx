import styles from './StatusDot.module.css'

interface StatusDotProps {
  status: 'ok' | 'warn' | 'error' | 'unknown'
}

export function StatusDot({ status }: StatusDotProps) {
  return <span className={[styles.dot, styles[status]].join(' ')} aria-label={status} />
}
