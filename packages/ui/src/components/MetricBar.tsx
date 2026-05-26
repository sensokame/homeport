import styles from './MetricBar.module.css'

interface MetricBarProps {
  label: string
  value: string
  percent: number
}

function fillColor(pct: number) {
  if (pct < 60) return styles.green
  if (pct < 80) return styles.yellow
  return styles.red
}

export function MetricBar({ label, value, percent }: MetricBarProps) {
  const clamped = Math.min(Math.max(percent, 0), 100)
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
      </div>
      <div className={styles.track}>
        <div className={[styles.fill, fillColor(clamped)].join(' ')} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}
