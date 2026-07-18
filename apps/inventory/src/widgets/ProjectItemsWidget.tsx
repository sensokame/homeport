import { useEffect, useState } from 'react'
import { Badge } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type { ProjectItems } from '../types'
import styles from './InventoryOverviewWidget.module.css'

const STATUS_ORDER = ['depleted', 'needed', 'low', 'ordered']

function badgeVariant(status: string): 'error' | 'warn' | 'default' {
  if (status === 'depleted') return 'error'
  if (status === 'needed' || status === 'low') return 'warn'
  return 'default'
}

export function ProjectItemsWidget({ config, satelliteUrl, publicUrl, onStatusChange }: WidgetProps) {
  const slug = config.project_slug as string | undefined
  const [data, setData] = useState<ProjectItems | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) { setLoading(false); return }
    fetch(`${satelliteUrl}/api/projects/${slug}/items`)
      .then(r => r.json())
      .then((d: ProjectItems) => {
        setData(d)
        const needsAttention = d.assignments.some(a => (a.item_status ?? 'in_stock') !== 'in_stock')
        onStatusChange?.(needsAttention ? 'warn' : 'ok')
      })
      .catch(() => onStatusChange?.('error'))
      .finally(() => setLoading(false))
  }, [satelliteUrl, slug])

  if (!slug) return <p className={styles.empty}>No project slug configured.</p>
  if (loading) return <p className={styles.empty}>Loading…</p>
  if (!data || data.assignments.length === 0) return <p className={styles.empty}>No items assigned.</p>

  const sorted = [...data.assignments].sort(
    (a, b) => STATUS_ORDER.indexOf(a.item_status ?? 'in_stock') - STATUS_ORDER.indexOf(b.item_status ?? 'in_stock')
  )

  return (
    <div className={styles.panel}>
      <div className={styles.itemList}>
        {sorted.map(a => {
          const status = a.item_status ?? 'in_stock'
          return (
            <div key={a.item_id} className={styles.itemRow}>
              <a
                className={[styles.itemLink, status === 'depleted' ? styles.itemNameDepleted : ''].filter(Boolean).join(' ')}
                href={`${publicUrl}/#/?item=${encodeURIComponent(a.item_id)}`}
                target="_blank"
                rel="noreferrer"
              >
                {a.item_name} × {a.quantity_reserved}
              </a>
              <div className={styles.badges}>
                <Badge label={status} variant={badgeVariant(status)} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
