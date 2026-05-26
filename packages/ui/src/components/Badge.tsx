import styles from './Badge.module.css'

interface BadgeProps {
  label: string
  variant?: 'ok' | 'warn' | 'error' | 'default'
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  return <span className={[styles.badge, styles[variant]].join(' ')}>{label}</span>
}
