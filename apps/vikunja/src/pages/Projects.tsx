import { useState, useEffect } from 'react'
import type { Project } from '../types'
import styles from './Projects.module.css'

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className={styles.empty}>Loading…</p>
  if (projects.length === 0) return <p className={styles.empty}>No projects yet.</p>

  return (
    <div className={styles.root}>
      {projects.map(p => (
        <div key={p.id} className={styles.row}>
          <span className={styles.name}>{p.title}</span>
          <span className={styles.right}>
            <span className={styles.count}>
              {p.version && <>{p.version} · </>}
              {p.task_count} task{p.task_count !== 1 ? 's' : ''}
            </span>
            <a
              className={styles.open}
              href={`http://vikunja.station/projects/${p.id}`}
              target="_blank"
              rel="noreferrer"
            >open →</a>
          </span>
        </div>
      ))}
    </div>
  )
}
