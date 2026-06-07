import type { WidgetManifest } from '@homeport/ui'
import styles from './SettingsDrawer.module.css'

interface WidgetInstance {
  instanceId: string
  widgetId: string
  satelliteId?: string
  config: Record<string, unknown>
}

interface TabEntry {
  id: string
  label: string
  widgets: WidgetInstance[]
}

interface SettingsDrawerProps {
  open: boolean
  onClose: () => void
  tabs: TabEntry[]
  registry: Record<string, WidgetManifest>
  onRemoveWidget: (tabId: string, instanceId: string) => void
}

export function SettingsDrawer({ open, onClose, tabs, registry, onRemoveWidget }: SettingsDrawerProps) {
  if (!open) return null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.header}>
          <span className={styles.title}>Dashboard settings</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">✕</button>
        </div>
        <div className={styles.body}>
          {tabs.map(tab => (
            <section key={tab.id} className={styles.section}>
              <h3 className={styles.sectionTitle}>{tab.label}</h3>
              {tab.widgets.length === 0 ? (
                <p className={styles.empty}>No widgets on this tab.</p>
              ) : (
                <ul className={styles.list}>
                  {tab.widgets.map(w => {
                    const manifest = registry[w.widgetId]
                    return (
                      <li key={w.instanceId} className={styles.item}>
                        <div className={styles.itemInfo}>
                          <span className={styles.itemName}>{manifest?.name ?? w.widgetId}</span>
                          <span className={styles.itemSub}>{w.satelliteId} · {w.instanceId}</span>
                        </div>
                        <button
                          className={styles.removeBtn}
                          onClick={() => onRemoveWidget(tab.id, w.instanceId)}
                          aria-label={`Remove ${w.instanceId}`}
                        >
                          Remove
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      </aside>
    </>
  )
}
