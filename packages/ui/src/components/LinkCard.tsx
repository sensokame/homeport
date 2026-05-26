import { Card } from './Card'
import styles from './LinkCard.module.css'

interface LinkCardProps {
  name: string
  url: string
  description?: string
}

export function LinkCard({ name, url, description }: LinkCardProps) {
  return (
    <Card className={styles.card}>
      <span className={styles.name}>{name}</span>
      {description && <p className={styles.desc}>{description}</p>}
      <div className={styles.footer}>
        <a className={styles.link} href={url} target="_blank" rel="noopener">open →</a>
      </div>
    </Card>
  )
}
