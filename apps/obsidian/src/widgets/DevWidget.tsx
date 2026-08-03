import { useEffect, useState, useCallback } from 'react'
import { SwipeableCard } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type { DevProjectSummary } from './types'
import styles from './DevWidget.module.css'

function formatSlug(slug: string): string {
  return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function HomePanel({ projects }: { projects: DevProjectSummary[] }) {
  return (
    <div className={styles.panel}>
      <span className={styles.pageTitle}>Dev</span>
      <p className={styles.summary}>
        {projects.length} project{projects.length === 1 ? '' : 's'} tracked
      </p>
      <div className={styles.projectList}>
        {projects.map(p => (
          <a key={p.slug} className={styles.projectRow} href={`/#/workspace/${encodeURIComponent(p.slug)}`}>
            <span className={styles.projectName}>{formatSlug(p.slug)}</span>
            <span className={styles.projectMeta}>
              {p.open_session
                ? 'session in progress'
                : p.last_worked ? `last worked ${relativeTime(p.last_worked)}` : 'no sessions yet'}
              {p.current_streak_days > 0 && ` · ${p.current_streak_days}d streak`}
            </span>
          </a>
        ))}
        {projects.length === 0 && <p className={styles.empty}>No dev-companion sessions yet.</p>}
      </div>
    </div>
  )
}

export function DevWidget({ satelliteUrl, onStatusChange }: WidgetProps) {
  const [projects, setProjects] = useState<DevProjectSummary[] | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(() => {
    fetch(`${satelliteUrl}/api/dev/projects`)
      .then(r => r.json())
      .then((d: DevProjectSummary[]) => {
        setProjects(d)
        onStatusChange?.('ok')
      })
      .catch(() => onStatusChange?.('error'))
      .finally(() => setLoading(false))
  }, [satelliteUrl])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>
  if (!projects) return <div className={styles.panel}><p className={styles.empty}>Unavailable</p></div>

  return <SwipeableCard home={<HomePanel projects={projects} />} />
}
