import { useEffect, useState } from 'react'
import { SwipeableCard } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import styles from './InfraWidget.module.css'

interface Metric { label: string; value: string; alert?: boolean }
interface WidgetData { summary: string; metrics: Metric[] }
interface Container { name: string; status: string; group: string }

const GROUP_ORDER = ['internal', 'orchestrator', 'public']

function HomePanel({ data, containers }: { data: WidgetData; containers: Container[] }) {
  const running = containers.filter(c => c.status === 'running').length
  return (
    <div className={styles.panel}>
      <span className={styles.pageTitle}>Infrastructure</span>
      <p className={styles.summary}>{running} / {containers.length} containers running</p>
      <div className={styles.metricGrid}>
        {data.metrics.map(m => (
          <div key={m.label} className={styles.metric}>
            <span className={[styles.metricValue, m.alert ? styles.alert : ''].filter(Boolean).join(' ')}>
              {m.value}
            </span>
            <span className={styles.metricLabel}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupPanel({ group, containers }: { group: string; containers: Container[] }) {
  return (
    <div className={styles.panel}>
      <span className={styles.groupTitle}>{group}</span>
      <div className={styles.containerList}>
        {containers.map(c => (
          <div key={c.name} className={styles.containerRow}>
            <span className={styles.containerName}>{c.name}</span>
            <span className={[styles.dot, c.status === 'running' ? styles.dotRunning : styles.dotStopped].join(' ')} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function InfraWidget({ satelliteUrl, onStatusChange }: WidgetProps) {
  const [data, setData] = useState<WidgetData | null>(null)
  const [containers, setContainers] = useState<Container[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function poll() {
      Promise.all([
        fetch(`${satelliteUrl}/widget`).then(r => r.json()),
        fetch(`${satelliteUrl}/api/containers`).then(r => r.json()),
      ])
        .then(([widget, ctrs]: [WidgetData, Container[]]) => {
          setData(widget)
          setContainers(ctrs)
          const anyDown = ctrs.some(c => c.status !== 'running')
          onStatusChange?.(anyDown ? 'warn' : 'ok')
        })
        .catch(() => onStatusChange?.('error'))
        .finally(() => setLoading(false))
    }

    poll()
    const timer = setInterval(poll, 2_000)
    return () => clearInterval(timer)
  }, [satelliteUrl, onStatusChange])

  if (loading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>
  if (!data) return <div className={styles.panel}><p className={styles.empty}>Unavailable</p></div>

  const groups = GROUP_ORDER
    .map(g => ({ group: g, containers: containers.filter(c => c.group === g) }))
    .filter(g => g.containers.length > 0)

  return (
    <SwipeableCard
      home={<HomePanel data={data} containers={containers} />}
      pages={groups.map(g => <GroupPanel key={g.group} group={g.group} containers={g.containers} />)}
    />
  )
}
