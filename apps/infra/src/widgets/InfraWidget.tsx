import { useEffect, useState } from 'react'
import { SwipeableCard } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import styles from './InfraWidget.module.css'

interface Metric { label: string; value: string; alert?: boolean }
interface WidgetData { status: 'ok' | 'warn' | 'error'; summary: string; metrics: Metric[] }
interface Container { name: string; status: string; group: string; url: string }
interface Check { label: string; level: 'ok' | 'warn' | 'error'; detail: string }

interface HealthResponse {
  status: {
    checked_at: string
    smart: { passed: boolean | null; temperature_c: number | null; media_errors: number | null; unsafe_shutdowns: number | null } | null
    fail2ban: { currently_banned: number; total_banned: number } | null
    apt: { upgradable_total: number; upgradable_security: number }
  } | null
  integrity: { finished_at: string; clean: boolean; findings: unknown[] } | null
  checks: { checked_at: string; checks: Record<string, Check> } | null
  stale: boolean
  summary_status: 'ok' | 'warn' | 'error'
}

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
            {c.url && (
              <a className={styles.openLink} href={c.url} target="_blank" rel="noopener"
                onClick={e => e.stopPropagation()}>open →</a>
            )}
            <span className={[styles.dot, c.status === 'running' ? styles.dotRunning : styles.dotStopped].join(' ')} />
          </div>
        ))}
      </div>
    </div>
  )
}

function HealthPanel({ health }: { health: HealthResponse | null }) {
  if (!health || !health.status) {
    return (
      <div className={styles.panel}>
        <span className={styles.groupTitle}>Health & Security</span>
        <p className={styles.empty}>No data yet — host check runs every 5 min.</p>
      </div>
    )
  }
  const { smart, fail2ban, apt } = health.status
  return (
    <div className={styles.panel}>
      <span className={styles.groupTitle}>Health & Security</span>
      {health.stale && <p className={styles.empty}>Data is stale — host health-check timer may not be running.</p>}
      <div className={styles.metricGrid}>
        <div className={styles.metric}>
          <span className={[styles.metricValue, smart?.passed === false ? styles.alert : ''].filter(Boolean).join(' ')}>
            {smart?.passed === null || smart?.passed === undefined ? '—' : smart.passed ? 'OK' : 'FAILED'}
          </span>
          <span className={styles.metricLabel}>Disk SMART</span>
        </div>
        <div className={styles.metric}>
          <span className={[styles.metricValue, (fail2ban?.currently_banned ?? 0) > 0 ? styles.alert : ''].filter(Boolean).join(' ')}>
            {fail2ban?.currently_banned ?? '—'}
          </span>
          <span className={styles.metricLabel}>Banned IPs</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{apt?.upgradable_total ?? '—'}</span>
          <span className={styles.metricLabel}>Pending updates</span>
        </div>
      </div>
      <p className={styles.summary}>
        {health.integrity
          ? health.integrity.clean
            ? `Integrity scan clean (last: ${new Date(health.integrity.finished_at).toLocaleDateString()})`
            : `Integrity scan found ${health.integrity.findings.length} issue(s)`
          : 'No integrity scan run yet'}
      </p>
    </div>
  )
}

// Only what needs attention; the full list lives on infra.station.
function ChecksPanel({ health }: { health: HealthResponse | null }) {
  const all = Object.values(health?.checks?.checks ?? {})
  const attention = all
    .filter(c => c.level !== 'ok')
    .sort((a, b) => (a.level === b.level ? a.label.localeCompare(b.label) : a.level === 'error' ? -1 : 1))
  return (
    <div className={styles.panel}>
      <span className={styles.groupTitle}>Checks</span>
      {all.length === 0 ? (
        <p className={styles.empty}>No check results yet.</p>
      ) : attention.length === 0 ? (
        <p className={styles.summary}>All {all.length} checks ok</p>
      ) : (
        <div className={styles.containerList}>
          {attention.map(c => (
            <div key={c.label} className={styles.containerRow} title={c.detail}>
              <span className={styles.containerName}>{c.label}</span>
              <span className={[styles.dot, c.level === 'error' ? styles.dotStopped : styles.dotWarn].join(' ')} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function InfraWidget({ satelliteUrl, onStatusChange }: WidgetProps) {
  const [data, setData] = useState<WidgetData | null>(null)
  const [containers, setContainers] = useState<Container[]>([])
  const [health, setHealth] = useState<HealthResponse | null>(null)
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
          onStatusChange?.(widget.status)
        })
        .catch(() => onStatusChange?.('error'))
        .finally(() => setLoading(false))
    }

    function pollHealth() {
      fetch(`${satelliteUrl}/api/health`).then(r => r.json()).then(setHealth).catch(() => {})
    }

    poll()
    pollHealth()
    const timer = setInterval(poll, 2_000)
    const healthTimer = setInterval(pollHealth, 60_000)
    return () => { clearInterval(timer); clearInterval(healthTimer) }
  }, [satelliteUrl, onStatusChange])

  if (loading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>
  if (!data) return <div className={styles.panel}><p className={styles.empty}>Unavailable</p></div>

  const groups = GROUP_ORDER
    .map(g => ({ group: g, containers: containers.filter(c => c.group === g) }))
    .filter(g => g.containers.length > 0)

  return (
    <SwipeableCard
      home={<HomePanel data={data} containers={containers} />}
      pages={[
        ...groups.map(g => <GroupPanel key={g.group} group={g.group} containers={g.containers} />),
        <HealthPanel key="health" health={health} />,
        <ChecksPanel key="checks" health={health} />,
      ]}
    />
  )
}
