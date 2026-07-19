import { Badge } from '@homeport/ui'
import type { ProjectCategory, ProjectEntry } from '../types'
import { isVisibleStatus, badgeVariant } from './projectStatus'
import styles from './Overview.module.css'

interface OverviewProps {
  categories: ProjectCategory[]
}

function CompactRow({ project }: { project: ProjectEntry }) {
  const name = project.slug
    ? <a className={styles.rowName} href={`#/project/${encodeURIComponent(project.slug)}`}>{project.name}</a>
    : <span className={styles.rowName}>{project.name}</span>
  return (
    <div className={styles.row}>
      {name}
      <span className={styles.rowNextAction}>{project.next_action}</span>
      <Badge
        label={`${project.status_emoji} ${project.status_label}`}
        variant={badgeVariant(project.status_label)}
      />
    </div>
  )
}

export default function Overview({ categories }: OverviewProps) {
  const visible = categories
    .map(cat => ({ ...cat, projects: cat.projects.filter(p => isVisibleStatus(p.status_label)) }))
    .filter(cat => cat.projects.length > 0)

  return (
    <div className={styles.root}>
      {visible.map(cat => (
        <div key={cat.name} className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>{cat.name}</span>
          </div>
          <div className={styles.list}>
            {cat.projects.map(p => <CompactRow key={p.name} project={p} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
