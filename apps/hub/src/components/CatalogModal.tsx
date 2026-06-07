import { useState, useEffect } from 'react'
import styles from './CatalogModal.module.css'

interface CatalogWidget {
  id: string
  name: string
  description: string
}

interface CatalogData {
  builtins: CatalogWidget[]
  satellites: Record<string, CatalogWidget[]>
}

interface CatalogModalProps {
  targetTabLabel: string
  onClose: () => void
  onAdd: (widgetId: string, satelliteId?: string) => void
}

export function CatalogModal({ targetTabLabel, onClose, onAdd }: CatalogModalProps) {
  const [catalog, setCatalog] = useState<CatalogData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/catalog')
      .then(r => r.json())
      .then(data => { setCatalog(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Add widget — {targetTabLabel}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.body}>
          {loading ? (
            <p className={styles.muted}>Loading catalog…</p>
          ) : !catalog ? (
            <p className={styles.muted}>Failed to load catalog.</p>
          ) : (
            <>
              {catalog.builtins.length > 0 && (
                <section className={styles.group}>
                  <h4 className={styles.groupLabel}>Built-in</h4>
                  {catalog.builtins.map(w => (
                    <div key={w.id} className={styles.widgetRow}>
                      <div className={styles.widgetInfo}>
                        <span className={styles.widgetName}>{w.name}</span>
                        <span className={styles.widgetDesc}>{w.description}</span>
                      </div>
                      <button className={styles.addBtn} onClick={() => onAdd(w.id)}>
                        Add →
                      </button>
                    </div>
                  ))}
                </section>
              )}
              {Object.entries(catalog.satellites).map(([satId, widgets]) =>
                widgets.length === 0 ? null : (
                  <section key={satId} className={styles.group}>
                    <h4 className={styles.groupLabel}>{satId}</h4>
                    {widgets.map(w => (
                      <div key={w.id} className={styles.widgetRow}>
                        <div className={styles.widgetInfo}>
                          <span className={styles.widgetName}>{w.name}</span>
                          <span className={styles.widgetDesc}>{w.description}</span>
                        </div>
                        <button className={styles.addBtn} onClick={() => onAdd(w.id, satId)}>
                          Add →
                        </button>
                      </div>
                    ))}
                  </section>
                )
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
