import { useEffect, useState } from 'react'
import type { WidgetProps } from '@homeport/ui'
import styles from './FitnessWidget.module.css'

interface Metric { label: string; value: string | number }
interface WidgetData { status: string; summary: string; metrics: Metric[] }

export function FitnessWidget({ satelliteUrl, onStatusChange }: WidgetProps) {
  const [data, setData] = useState<WidgetData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${satelliteUrl}/widget`)
      .then(r => r.json())
      .then((d: WidgetData) => {
        setData(d)
        onStatusChange?.(d.status === 'ok' ? 'ok' : d.status === 'error' ? 'error' : 'warn')
      })
      .catch(() => onStatusChange?.('error'))
      .finally(() => setLoading(false))
  }, [satelliteUrl])

  if (loading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>
  if (!data) return <div className={styles.panel}><p className={styles.empty}>Unavailable</p></div>

  return (
    <div className={styles.panel}>
      <p className={styles.summary}>{data.summary}</p>
      <div className={styles.metricGrid}>
        {data.metrics.map(m => (
          <div key={m.label} className={styles.metricRow}>
            <span className={styles.metricLabel}>{m.label}</span>
            <span className={styles.metricValue}>{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
