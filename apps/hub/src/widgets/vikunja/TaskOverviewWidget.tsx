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

function HomePanel({ tasks, projects, tasksByProject, onNavigate }: {
  tasks: VTask[]
  projects: VProject[]
  tasksByProject: Map<number, VTask[]>
  onNavigate: (page: number) => void
}) {
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

  const LIMIT = 5
  const shown = urgent.slice(0, LIMIT)
  const remaining = urgent.length - shown.length

  const grouped = new Map<string, VTask[]>()
  for (const t of shown) {
    if (!grouped.has(t.project_name)) grouped.set(t.project_name, [])
    grouped.get(t.project_name)!.push(t)
  }

  const activeProjects = projects.filter(p => (tasksByProject.get(p.id)?.length ?? 0) > 0)

  return (
    <div className={styles.panel}>
      <span className={styles.pageTitle}>Overview</span>
      <p className={styles.summary}>{parts.join(' · ')}</p>

      {urgent.length > 0 && (
        <div className={styles.urgentList}>
          {Array.from(grouped.entries()).map(([project, pts]) => (
            <div key={project} className={styles.group}>
              <span className={styles.groupLabel}>{project}</span>
              {pts.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          ))}
          {remaining > 0 && <p className={styles.more}>+{remaining} more urgent</p>}
        </div>
      )}

      {activeProjects.length > 0 && (
        <div className={styles.projectList}>
          {activeProjects.map((p, i) => (
            <button key={p.id} className={styles.projectRow} onClick={() => onNavigate(i + 1)}>
              <div className={styles.projectLeft}>
                <span className={styles.projectRowName}>{p.title}</span>
                {p.version && <span className={styles.projectRowVersion}>{p.version}</span>}
              </div>
              <span className={styles.projectRowCount}>
                {tasksByProject.get(p.id)?.length ?? 0} tasks
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectPanel({ project, tasks }: { project: VProject; tasks: VTask[] }) {
  const taskMeta = [
    `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`,
    project.blocked_count > 0 ? `${project.blocked_count} blocked` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className={styles.panel}>
      <div className={styles.projectMeta}>
        <div className={styles.projectLeft}>
          <span className={styles.projectName}>{project.title}</span>
          {project.version && <span className={styles.projectVersion}>{project.version}</span>}
        </div>
        <div className={styles.projectRight}>
          <span className={styles.projectCount}>{taskMeta}</span>
          <a
            className={styles.projectOpen}
            href={`http://vikunja.station/projects/${project.id}`}
            target="_blank"
            rel="noreferrer"
          >open →</a>
        </div>
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
  const [activePage, setActivePage] = useState(0)

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
      activePage={activePage}
      home={<HomePanel tasks={tasks} projects={projects} tasksByProject={tasksByProject} onNavigate={setActivePage} />}
      pages={activeProjects.map(p => (
        <ProjectPanel key={p.id} project={p} tasks={tasksByProject.get(p.id) ?? []} />
      ))}
    />
  )
}
