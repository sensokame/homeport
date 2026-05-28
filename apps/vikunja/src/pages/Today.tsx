import { useState, useEffect } from 'react'
import { Badge } from '@homeport/ui'
import type { Task } from '../types'
import styles from './Today.module.css'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function groupByProject(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = t.project_name
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return map
}

export default function Today() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then((all: Task[]) => {
        setTasks(all.filter(t => t.is_today || t.is_overdue))
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className={styles.empty}>Loading…</p>

  const overdue = tasks.filter(t => t.is_overdue)
  const today = tasks.filter(t => t.is_today && !t.is_overdue)

  if (tasks.length === 0) {
    return <p className={styles.empty}>Nothing due today — all clear!</p>
  }

  const renderGroup = (items: Task[], label: string, isOverdue = false) => {
    if (items.length === 0) return null
    const groups = groupByProject(items)
    return (
      <div className={styles.section}>
        <span className={styles.sectionTitle}>{label}</span>
        {Array.from(groups.entries()).map(([project, pts]) => (
          <div key={project} className={styles.group}>
            <span className={styles.groupLabel}>{project}</span>
            {pts.map(t => (
              <div key={t.id} className={`${styles.task} ${isOverdue ? styles.taskOverdue : ''}`}>
                <span className={styles.taskTitle}>{t.title}</span>
                {t.due_date && (
                  <span className={`${styles.taskDue} ${isOverdue ? styles.taskDueOverdue : ''}`}>
                    {formatDate(t.due_date)}
                  </span>
                )}
                {t.priority > 0 && <Badge label={`P${t.priority}`} variant="warn" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {renderGroup(overdue, 'Overdue', true)}
      {renderGroup(today, 'Due today')}
    </div>
  )
}
