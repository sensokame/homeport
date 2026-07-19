import { Card, Badge } from '@homeport/ui'
import type { ProjectCategory, ProjectEntry } from '../types'
import { isVisibleStatus, badgeVariant } from './projectStatus'
import { WORKSPACE_HASH_URL } from '../constants'
import styles from './CategoryDetail.module.css'

interface CategoryDetailProps {
  category: ProjectCategory
}

function ProjectCard({ project }: { project: ProjectEntry }) {
  const name = project.slug
    ? <a className={styles.cardName} href={`#/project/${encodeURIComponent(project.slug)}`}>{project.name}</a>
    : <span className={styles.cardName}>{project.name}</span>
  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        {name}
        <Badge
          label={`${project.status_emoji} ${project.status_label}`}
          variant={badgeVariant(project.status_label)}
        />
      </div>
      <p className={styles.nextAction}>{project.next_action}</p>
      {project.notes && <p className={styles.notes}>{project.notes}</p>}
      {project.slug && (
        <div className={styles.footer}>
          <a className={styles.link} href={`${WORKSPACE_HASH_URL}${project.slug}`} target="_blank" rel="noopener">
            open →
          </a>
        </div>
      )}
    </Card>
  )
}

export default function CategoryDetail({ category }: CategoryDetailProps) {
  const projects = category.projects.filter(p => isVisibleStatus(p.status_label))
  return (
    <div className={styles.root}>
      <h1 className={styles.title}>{category.name}</h1>
      <div className={styles.grid}>
        {projects.map(p => <ProjectCard key={p.name} project={p} />)}
      </div>
    </div>
  )
}
