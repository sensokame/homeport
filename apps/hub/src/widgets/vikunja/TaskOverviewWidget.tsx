import { useEffect, useState } from 'react'
import { SwipeableCard, Badge } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type { VTask, VProject } from './types'
import styles from './TaskOverviewWidget.module.css'

function fmt(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function TaskRow({ task }: { task: VTask }) {
  return (
    <div className={styles.taskRow}>
      <span className={[styles.taskTitle, task.is_overdue ? styles.taskTitleOverdue : ''].filter(Boolean).join(' ')}>
        {task.title}
      </span>
      <div className={styles.badges}>
        {task.is_waiting && <Badge label="waiting" variant="warn" />}
        {task.priority > 0 && <Badge label={`P${task.priority}`} variant="warn" />}
        {task.due_date && (
          <span className={[styles.due, task.is_overdue ? styles.dueOverdue : task.is_today ? styles.dueToday : ''].filter(Boolean).join(' ')}>
            {fmt(task.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}

function HomePanel({ tasks }: { tasks: VTask[] }) {
  const overdue = tasks.filter(t => t.is_overdue)
  const today = tasks.filter(t => t.is_today && !t.is_overdue)
  const blocked = tasks.filter(t => t.is_waiting)
  const urgent = [...overdue, ...today]

  const parts = [
    `${tasks.length} open`,
    today.length > 0 ? `${today.length} today` : null,
    overdue.length > 0 ? `${overdue.length} overdue` : null,
    blocked.length > 0 ? `${blocked.length} blocked` : null,
  ].filter(Boolean)

  const LIMIT = 7
  const shown = urgent.slice(0, LIMIT)
  const remaining = urgent.length - shown.length

  const grouped = new Map<string, VTask[]>()
  for (const t of shown) {
    if (!grouped.has(t.project_name)) grouped.set(t.project_name, [])
    grouped.get(t.project_name)!.push(t)
  }

  return (
    <div className={styles.panel}>
      <span className={styles.pageTitle}>Overview</span>
      <p className={styles.summary}>{parts.join(' · ')}</p>
      {urgent.length === 0 ? (
        <p className={styles.allClear}>Nothing urgent</p>
      ) : (
        <div className={styles.urgentList}>
          {Array.from(grouped.entries()).map(([project, pts]) => (
            <div key={project} className={styles.group}>
              <span className={styles.groupLabel}>{project}</span>
              {pts.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          ))}
          {remaining > 0 && <p className={styles.more}>+{remaining} more</p>}
        </div>
      )}
    </div>
  )
}

function ProjectPanel({ project, tasks }: { project: VProject; tasks: VTask[] }) {
  return (
    <div className={styles.panel}>
      <div className={styles.projectMeta}>
        <span className={styles.projectName}>{project.title}</span>
        <span className={styles.projectCount}>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          {project.blocked_count > 0 ? ` · ${project.blocked_count} blocked` : ''}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className={styles.empty}>No open tasks</p>
      ) : (
        <div className={styles.taskList}>
          {tasks.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
    </div>
  )
}

export function TaskOverviewWidget({ satelliteUrl, onStatusChange }: WidgetProps) {
  const [tasks, setTasks] = useState<VTask[]>([])
  const [projects, setProjects] = useState<VProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${satelliteUrl}/api/tasks`).then(r => r.json()),
      fetch(`${satelliteUrl}/api/projects`).then(r => r.json()),
    ])
      .then(([t, p]: [VTask[], VProject[]]) => {
        setTasks(t)
        setProjects(p)
        onStatusChange?.(t.some(x => x.is_overdue) ? 'warn' : 'ok')
      })
      .catch(() => onStatusChange?.('error'))
      .finally(() => setLoading(false))
  }, [satelliteUrl])

  if (loading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>

  const tasksByProject = new Map<number, VTask[]>()
  for (const t of tasks) {
    if (!tasksByProject.has(t.project_id)) tasksByProject.set(t.project_id, [])
    tasksByProject.get(t.project_id)!.push(t)
  }

  const activeProjects = projects
    .filter(p => (tasksByProject.get(p.id)?.length ?? 0) > 0)
    .sort((a, b) => (tasksByProject.get(b.id)?.length ?? 0) - (tasksByProject.get(a.id)?.length ?? 0))

  return (
    <SwipeableCard
      home={<HomePanel tasks={tasks} />}
      pages={activeProjects.map(p => (
        <ProjectPanel key={p.id} project={p} tasks={tasksByProject.get(p.id) ?? []} />
      ))}
    />
  )
}
