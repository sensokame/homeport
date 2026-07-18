import { useEffect, useState } from 'react'
import { SwipeableCard, Badge } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type { IItem, IProject, IAssignment } from './types'
import styles from './InventoryOverviewWidget.module.css'

const STATUS_ORDER = ['depleted', 'needed', 'low', 'ordered']

function formatSlug(slug: string): string {
  return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function badgeVariant(status: string): 'error' | 'warn' | 'default' {
  if (status === 'depleted') return 'error'
  if (status === 'needed' || status === 'low') return 'warn'
  return 'default'
}

function ItemRow({ item, status }: { item: string; status: string }) {
  return (
    <div className={styles.itemRow}>
      <span className={[styles.itemName, status === 'depleted' ? styles.itemNameDepleted : ''].filter(Boolean).join(' ')}>
        {item}
      </span>
      <div className={styles.badges}>
        <Badge label={status} variant={badgeVariant(status)} />
      </div>
    </div>
  )
}

function HomePanel({ items }: { items: IItem[] }) {
  const attention = items.filter(i => i.status !== 'in_stock')
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))

  const actionable = attention.filter(i => i.status !== 'ordered')

  const parts = [
    `${items.length} items`,
    actionable.length > 0 ? `${actionable.length} need attention` : null,
    actionable.length === 0 && attention.length > 0 ? `${attention.length} on order` : null,
  ].filter(Boolean)

  const LIMIT = 7
  const shown = attention.slice(0, LIMIT)
  const remaining = attention.length - shown.length

  return (
    <div className={styles.panel}>
      <span className={styles.pageTitle}>Inventory</span>
      <p className={styles.summary}>{parts.join(' · ')}</p>
      {attention.length === 0 ? (
        <p className={styles.allClear}>All clear</p>
      ) : (
        <div className={styles.attentionList}>
          {shown.map(i => <ItemRow key={i.id} item={i.name} status={i.status} />)}
          {remaining > 0 && <p className={styles.more}>+{remaining} more</p>}
        </div>
      )}
    </div>
  )
}

function ProjectPanel({ project }: { project: IProject }) {
  const sorted = [...project.assignments].sort(
    (a, b) => STATUS_ORDER.indexOf(a.item_status) - STATUS_ORDER.indexOf(b.item_status)
  )
  return (
    <div className={styles.panel}>
      <div className={styles.projectMeta}>
        <span className={styles.projectName}>{formatSlug(project.slug)}</span>
        <span className={styles.projectCount}>{sorted.length} item{sorted.length !== 1 ? 's' : ''}</span>
      </div>
      <div className={styles.itemList}>
        {sorted.map((a: IAssignment) => (
          <ItemRow key={a.item_id} item={a.item_name} status={a.item_status} />
        ))}
      </div>
    </div>
  )
}

export function InventoryOverviewWidget({ satelliteUrl, onStatusChange }: WidgetProps) {
  const [items, setItems] = useState<IItem[]>([])
  const [projects, setProjects] = useState<IProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${satelliteUrl}/api/items`).then(r => r.json()),
      fetch(`${satelliteUrl}/api/widget/projects`).then(r => r.json()),
    ])
      .then(([allItems, widgetProjects]: [IItem[], IProject[]]) => {
        setItems(allItems)
        setProjects(widgetProjects)
        const needsAttention = allItems.some(i => i.status === 'depleted' || i.status === 'needed' || i.status === 'low')
        onStatusChange?.(needsAttention ? 'warn' : 'ok')
      })
      .catch(() => onStatusChange?.('error'))
      .finally(() => setLoading(false))
  }, [satelliteUrl])

  if (loading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>

  return (
    <SwipeableCard
      home={<HomePanel items={items} />}
      pages={projects.map(p => <ProjectPanel key={p.slug} project={p} />)}
    />
  )
}
