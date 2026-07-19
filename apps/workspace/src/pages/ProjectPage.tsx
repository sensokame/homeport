import { useState, useEffect } from 'react'
import { Badge } from '@homeport/ui'
import type { DevSessionsSummary, ProjectDetail, ProjectEntry } from '../types'
import { badgeVariant } from './projectStatus'
import { getProjectDetail, getDevSessions } from '../api'
import { WORKSPACE_HASH_URL } from '../constants'
import styles from './ProjectPage.module.css'

interface ProjectPageProps {
  entry: ProjectEntry
  slugIndex: Map<string, ProjectEntry>
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function ProjectPage({ entry, slugIndex }: ProjectPageProps) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [devSessions, setDevSessions] = useState<DevSessionsSummary | null>(null)

  useEffect(() => {
    setDetail(null)
    setError(null)
    setDevSessions(null)
    if (!entry.slug) return
    getProjectDetail(entry.slug).then(setDetail).catch(e => setError(e.message))
    // Best-effort — most projects have no dev-companion history, and that's
    // not an error state, so failures here don't block the rest of the page.
    getDevSessions(entry.slug).then(setDevSessions).catch(() => {})
  }, [entry.slug])

  const hasTasks = detail ? detail.tasks.some(g => g.items.length > 0) : false

  return (
    <div className={styles.root}>
      <a className={styles.back} href="#/">← Overview</a>

      <div className={styles.header}>
        <h1 className={styles.title}>{entry.name}</h1>
        <Badge
          label={`${entry.status_emoji} ${entry.status_label}`}
          variant={badgeVariant(entry.status_label)}
        />
      </div>

      {(detail?.description || entry.notes) && (
        <p className={styles.description}>{detail?.description || entry.notes}</p>
      )}

      {devSessions && (devSessions.sessions.length > 0 || devSessions.open_session) && (
        <p className={styles.activity}>
          {devSessions.open_session
            ? 'Session in progress'
            : `Last worked ${relativeTime(devSessions.sessions[devSessions.sessions.length - 1].ended_at)}`}
          {devSessions.current_streak_days > 0 &&
            ` · ${devSessions.current_streak_days}-day streak`}
        </p>
      )}

      {error && <p className={styles.error}>Couldn't load project detail ({error})</p>}

      {detail && detail.milestones.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Milestones</h2>
          <table className={styles.table}>
            <thead>
              <tr>{Object.keys(detail.milestones[0]).map(k => <th key={k}>{k}</th>)}</tr>
            </thead>
            <tbody>
              {detail.milestones.map((row, i) => (
                <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {hasTasks && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tasks</h2>
          {detail!.tasks.filter(g => g.items.length > 0).map((group, i) => (
            <div key={i} className={styles.taskGroup}>
              {group.heading && <h3 className={styles.taskHeading}>{group.heading}</h3>}
              <ul className={styles.taskList}>
                {group.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            </div>
          ))}
        </section>
      )}

      {detail && detail.links.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Related projects</h2>
          <div className={styles.linkRow}>
            {detail.links.map(slug => {
              const linked = slugIndex.get(slug)
              return (
                <a key={slug} className={styles.relatedLink} href={`#/project/${encodeURIComponent(slug)}`}>
                  {linked?.name ?? slug}
                </a>
              )
            })}
          </div>
        </section>
      )}

      {entry.slug && (
        <a className={styles.openLink} href={`${WORKSPACE_HASH_URL}${entry.slug}`} target="_blank" rel="noopener">
          open live tasks + inventory in panel →
        </a>
      )}
    </div>
  )
}
