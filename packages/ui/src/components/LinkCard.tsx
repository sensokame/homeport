import type { ReactNode } from 'react'
import { Card } from './Card'
import styles from './LinkCard.module.css'

interface LinkCardProps {
  name: string
  url: string
  description?: string
  icon?: ReactNode
}

export function LinkCard({ name, url, description, icon }: LinkCardProps) {
  return (
    <Card className={styles.card}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <span className={styles.name}>{name}</span>
      {description && <p className={styles.desc}>{description}</p>}
      <div className={styles.footer}>
        <a className={styles.link} href={url} target="_blank" rel="noopener">open →</a>
      </div>
    </Card>
  )
}
