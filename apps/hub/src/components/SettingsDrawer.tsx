import { useState, useRef } from 'react'
import type { WidgetManifest } from '@homeport/ui'
import { CatalogModal } from './CatalogModal'
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

interface DragState {
  fromTabId: string
  fromIndex: number
  overTabId: string
  overIndex: number  // equals tab.widgets.length for the append zone
}

interface SettingsDrawerProps {
  open: boolean
  onClose: () => void
  tabs: TabEntry[]
  registry: Record<string, WidgetManifest>
  onRemoveWidget: (tabId: string, instanceId: string) => void
  onAddTab: (label: string) => void
  onRenameTab: (tabId: string, label: string) => void
  onDeleteTab: (tabId: string) => void
  onAddWidget: (tabId: string, widgetId: string, satelliteId?: string) => void
  onDropWidget: (fromTabId: string, fromIndex: number, toTabId: string, toIndex: number) => void
}

export function SettingsDrawer({
  open, onClose, tabs, registry,
  onRemoveWidget, onAddTab, onRenameTab, onDeleteTab, onAddWidget, onDropWidget,
}: SettingsDrawerProps) {
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [addTabOpen, setAddTabOpen] = useState(false)
  const [addTabValue, setAddTabValue] = useState('')
  const [catalogTabId, setCatalogTabId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function startRename(tab: TabEntry) {
    setRenamingTabId(tab.id)
    setRenameValue(tab.label)
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }

  function commitRename() {
    if (renamingTabId && renameValue.trim()) {
      onRenameTab(renamingTabId, renameValue.trim())
    }
    setRenamingTabId(null)
    setRenameValue('')
  }

  function cancelRename() {
    setRenamingTabId(null)
    setRenameValue('')
  }

  function submitAddTab() {
    if (addTabValue.trim()) {
      onAddTab(addTabValue.trim())
      setAddTabValue('')
      setAddTabOpen(false)
    }
  }

  function commitDrop(toTabId: string, toIndex: number) {
    if (dragState) {
      onDropWidget(dragState.fromTabId, dragState.fromIndex, toTabId, toIndex)
    }
    setDragState(null)
  }

  const catalogTab = catalogTabId ? tabs.find(t => t.id === catalogTabId) : null
  const isDragging = dragState !== null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.header}>
          <span className={styles.title}>Dashboard settings</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">✕</button>
        </div>
        <div className={styles.body}>
          {tabs.map(tab => {
            const isDropTarget = isDragging && dragState.overTabId === tab.id
            return (
              <section
                key={tab.id}
                className={[styles.section, isDropTarget && dragState.fromTabId !== tab.id ? styles.sectionDropTarget : ''].filter(Boolean).join(' ')}
              >
                {renamingTabId === tab.id ? (
                  <div className={styles.renameRow}>
                    <input
                      ref={renameInputRef}
                      className={styles.renameInput}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') cancelRename()
                      }}
                    />
                    <button className={styles.renameConfirm} onClick={commitRename} aria-label="Confirm">��</button>
                    <button className={styles.renameCancel} onClick={cancelRename} aria-label="Cancel">✗</button>
                  </div>
                ) : (
                  <div className={styles.tabHeader}>
                    <h3 className={styles.sectionTitle}>{tab.label}</h3>
                    <div className={styles.tabActions}>
                      <button className={styles.tabAction} onClick={() => startRename(tab)}>Rename</button>
                      {tabs.length > 1 && (
                        <button
                          className={styles.tabActionDanger}
                          onClick={() => onDeleteTab(tab.id)}
                          aria-label={`Delete ${tab.label}`}
                        >✕</button>
                      )}
                    </div>
                  </div>
                )}

                {tab.widgets.length === 0 && !isDragging ? (
                  <p className={styles.empty}>No widgets on this tab.</p>
                ) : (
                  <ul className={styles.list}>
                    {tab.widgets.map((w, idx) => {
                      const manifest = registry[w.widgetId]
                      const isItemDragging = dragState?.fromTabId === tab.id && dragState.fromIndex === idx
                      const isItemOver = dragState?.overTabId === tab.id && dragState.overIndex === idx
                        && !(dragState.fromTabId === tab.id && dragState.fromIndex === idx)
                      return (
                        <li
                          key={w.instanceId}
                          className={[
                            styles.item,
                            isItemDragging ? styles.itemDragging : '',
                            isItemOver ? styles.itemDragOver : '',
                          ].filter(Boolean).join(' ')}
                          draggable
                          onDragStart={() => setDragState({ fromTabId: tab.id, fromIndex: idx, overTabId: tab.id, overIndex: idx })}
                          onDragOver={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (dragState) setDragState(prev => prev ? { ...prev, overTabId: tab.id, overIndex: idx } : null)
                          }}
                          onDrop={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            commitDrop(tab.id, idx)
                          }}
                          onDragEnd={() => setDragState(null)}
                        >
                          <span className={styles.dragHandle} aria-hidden>⠿</span>
                          <div className={styles.itemInfo}>
                            <span className={styles.itemName}>{manifest?.name ?? w.widgetId}</span>
                            <span className={styles.itemSub}>{w.satelliteId ?? 'builtin'} · {w.instanceId}</span>
                          </div>
                          <div className={styles.itemActions}>
                            <button
                              className={styles.removeBtn}
                              onClick={() => onRemoveWidget(tab.id, w.instanceId)}
                              aria-label={`Remove ${w.instanceId}`}
                            >✕</button>
                          </div>
                        </li>
                      )
                    })}

                    {isDragging && (
                      <li
                        className={[
                          styles.appendZone,
                          dragState.overTabId === tab.id && dragState.overIndex === tab.widgets.length ? styles.appendZoneActive : '',
                        ].filter(Boolean).join(' ')}
                        onDragOver={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (dragState) setDragState(prev => prev ? { ...prev, overTabId: tab.id, overIndex: tab.widgets.length } : null)
                        }}
                        onDrop={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          commitDrop(tab.id, tab.widgets.length)
                        }}
                      >
                        drop here
                      </li>
                    )}
                  </ul>
                )}

                {/* Empty tab drop zone (shown only when dragging into an empty tab) */}
                {tab.widgets.length === 0 && isDragging && (
                  <div
                    className={[
                      styles.emptyDropZone,
                      dragState.overTabId === tab.id ? styles.emptyDropZoneActive : '',
                    ].filter(Boolean).join(' ')}
                    onDragOver={e => {
                      e.preventDefault()
                      if (dragState) setDragState(prev => prev ? { ...prev, overTabId: tab.id, overIndex: 0 } : null)
                    }}
                    onDrop={e => {
                      e.preventDefault()
                      commitDrop(tab.id, 0)
                    }}
                  >
                    drop here
                  </div>
                )}

                <button className={styles.addWidgetBtn} onClick={() => setCatalogTabId(tab.id)}>
                  + Add widget
                </button>
              </section>
            )
          })}

          <button className={styles.addTabBtn} onClick={() => { setAddTabOpen(true); setAddTabValue('') }}>
            + Add tab
          </button>
        </div>
      </aside>

      {addTabOpen && (
        <>
          <div className={styles.modalBackdrop} onClick={() => setAddTabOpen(false)} />
          <div className={styles.addTabModal}>
            <p className={styles.modalTitle}>New tab</p>
            <input
              className={styles.modalInput}
              placeholder="Tab name"
              value={addTabValue}
              onChange={e => setAddTabValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitAddTab()
                if (e.key === 'Escape') setAddTabOpen(false)
              }}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setAddTabOpen(false)}>Cancel</button>
              <button className={styles.modalConfirm} onClick={submitAddTab}>Create</button>
            </div>
          </div>
        </>
      )}

      {catalogTab && (
        <CatalogModal
          targetTabLabel={catalogTab.label}
          onClose={() => setCatalogTabId(null)}
          onAdd={(widgetId, satelliteId) => {
            onAddWidget(catalogTab.id, widgetId, satelliteId)
            setCatalogTabId(null)
          }}
        />
      )}
    </>
  )
}
