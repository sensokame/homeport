import { Card } from './Card'
import { StatusDot } from './StatusDot'
import styles from './WidgetCard.module.css'

interface Metric {
  label: string
  value: string | number
  alert?: boolean
}

export interface WidgetData {
  title: string
  status: 'ok' | 'warn' | 'error'
  summary: string
  metrics?: Metric[]
}

interface WidgetCardProps {
  data: WidgetData
  url: string
}

export function WidgetCard({ data, url }: WidgetCardProps) {
  return (
    <Card status={data.status} className={styles.card}>
      <div className={styles.header}>
        <StatusDot status={data.status} />
        <span className={styles.title}>{data.title}</span>
      </div>
      <p className={styles.summary}>{data.summary}</p>
      {data.metrics && data.metrics.length > 0 && (
        <div className={styles.metrics}>
          {data.metrics.map((m, i) => (
            <div key={i} className={styles.metric}>
              <span className={styles.metricLabel}>{m.label}</span>
              <span className={[styles.metricValue, m.alert ? styles.metricAlert : ''].filter(Boolean).join(' ')}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className={styles.footer}>
        <a className={styles.link} href={url} target="_blank" rel="noopener">open →</a>
      </div>
    </Card>
  )
}
