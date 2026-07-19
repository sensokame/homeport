import { useState, useEffect } from 'react'
import { Badge } from '@homeport/ui'
import type { ProjectDetail, ProjectEntry } from '../types'
import { badgeVariant } from './projectStatus'
import { getProjectDetail } from '../api'
import { WORKSPACE_HASH_URL } from '../constants'
import styles from './ProjectPage.module.css'

interface ProjectPageProps {
  entry: ProjectEntry
  slugIndex: Map<string, ProjectEntry>
}

export default function ProjectPage({ entry, slugIndex }: ProjectPageProps) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDetail(null)
    setError(null)
    if (!entry.slug) return
    getProjectDetail(entry.slug).then(setDetail).catch(e => setError(e.message))
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
