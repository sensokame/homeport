import { useEffect, useState } from 'react'
import { Badge } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type { VTask, VProject } from './types'
import styles from './ProjectFocusWidget.module.css'

function fmt(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ProjectFocusWidget({ satelliteUrl, config, onStatusChange }: WidgetProps) {
  const projectId = config.project_id as number
  const [tasks, setTasks] = useState<VTask[]>([])
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${satelliteUrl}/api/tasks`).then(r => r.json()),
      fetch(`${satelliteUrl}/api/projects`).then(r => r.json()),
    ])
      .then(([allTasks, allProjects]: [VTask[], VProject[]]) => {
        const filtered = allTasks.filter(t => t.project_id === projectId)
        const project = allProjects.find(p => p.id === projectId)
        setTasks(filtered)
        setProjectName(project?.title ?? `Project ${projectId}`)
        onStatusChange?.(filtered.some(t => t.is_overdue) ? 'warn' : 'ok')
      })
      .catch(() => onStatusChange?.('error'))
      .finally(() => setLoading(false))
  }, [satelliteUrl, projectId])

  if (loading) return <div className={styles.root}><p className={styles.empty}>Loading…</p></div>

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.projectName}>{projectName}</span>
        <span className={styles.count}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
      </div>
      {tasks.length === 0 ? (
        <p className={styles.empty}>No open tasks</p>
      ) : (
        <div className={styles.taskList}>
          {tasks.map(t => (
            <div key={t.id} className={styles.taskRow}>
              <span className={[styles.taskTitle, t.is_overdue ? styles.taskTitleOverdue : ''].filter(Boolean).join(' ')}>
                {t.title}
              </span>
              <div className={styles.badges}>
                {t.is_waiting && <Badge label="waiting" variant="warn" />}
                {t.priority > 0 && <Badge label={`P${t.priority}`} variant="warn" />}
                {t.due_date && (
                  <span className={[styles.due, t.is_overdue ? styles.dueOverdue : t.is_today ? styles.dueToday : ''].filter(Boolean).join(' ')}>
                    {fmt(t.due_date)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
