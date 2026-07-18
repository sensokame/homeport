import { useCallback, useEffect, useState } from 'react'
import type { WidgetProps } from '@homeport/ui'
import styles from './ProjectTasksWidget.module.css'

interface TaskGroup {
  heading: string | null
  items: string[]
}

interface ProjectTasks {
  slug: string
  source_file: string
  tasks: TaskGroup[]
  notes_html: string
}

const FADE_MS = 300

function taskKey(heading: string | null, index: number) {
  return `${heading ?? ''}:${index}`
}

export function ProjectTasksWidget({ config, satelliteUrl, onStatusChange }: WidgetProps) {
  const slug = config.project_slug as string | undefined
  const [data, setData] = useState<ProjectTasks | null>(null)
  const [loading, setLoading] = useState(true)
  const [completingKeys, setCompletingKeys] = useState<Set<string>>(new Set())

  const fetchData = useCallback(() => {
    if (!slug) return Promise.resolve()
    return fetch(`${satelliteUrl}/api/projects/${slug}`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then((d: ProjectTasks) => { setData(d); onStatusChange?.('ok') })
      .catch(() => onStatusChange?.('error'))
  }, [satelliteUrl, slug])

  useEffect(() => {
    if (!slug) { setLoading(false); return }
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [fetchData, slug])

  function handleComplete(heading: string | null, index: number) {
    const key = taskKey(heading, index)
    if (completingKeys.has(key)) return
    setCompletingKeys(prev => new Set(prev).add(key))

    fetch(`${satelliteUrl}/api/projects/${slug}/tasks/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heading, index }),
    })
      .then(r => { if (!r.ok) throw new Error(String(r.status)) })
      .then(() => new Promise(resolve => setTimeout(resolve, FADE_MS)))
      .then(() => fetchData())
      .catch(() => {})
      .finally(() => {
        setCompletingKeys(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
  }

  if (!slug) return <p className={styles.empty}>No project slug configured.</p>
  if (loading) return <p className={styles.empty}>Loading…</p>
  if (!data) return <p className={styles.empty}>Unavailable</p>

  const totalTasks = data.tasks.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className={styles.panel}>
      {totalTasks === 0 ? (
        <p className={styles.empty}>No open tasks.</p>
      ) : (
        data.tasks.map((g, i) => (
          <div key={g.heading ?? `_${i}`} className={styles.group}>
            {g.heading && <p className={styles.groupHeading}>{g.heading}</p>}
            {g.items.map((item, j) => {
              const key = taskKey(g.heading, j)
              const completing = completingKeys.has(key)
              return (
                <div
                  key={j}
                  className={completing ? `${styles.taskRow} ${styles.taskRowCompleting}` : styles.taskRow}
                >
                  <button
                    type="button"
                    className={styles.taskBox}
                    onClick={() => handleComplete(g.heading, j)}
                    disabled={completing}
                    aria-label="Mark task done"
                  >
                    {completing ? '☑' : '☐'}
                  </button>
                  <span>{item}</span>
                </div>
              )
            })}
          </div>
        ))
      )}
      <a
        className={styles.notesLink}
        href={`http://quartz.station/projects/${encodeURIComponent(slug)}/${encodeURIComponent(data.source_file.replace(/\.md$/, ''))}`}
        target="_blank"
        rel="noreferrer"
      >
        Open note in Quartz →
      </a>
    </div>
  )
}
