import styles from './TabBar.module.css'

interface Tab {
  id: string
  label: string
}

interface TabBarProps {
  tabs: Tab[]
  activeId: string
  onSelect: (id: string) => void
  onSettingsOpen: () => void
}

export function TabBar({ tabs, activeId, onSelect, onSettingsOpen }: TabBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={[styles.tab, tab.id === activeId ? styles.tabActive : ''].filter(Boolean).join(' ')}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <button className={styles.settingsBtn} onClick={onSettingsOpen} aria-label="Open settings">
        ⚙
      </button>
    </div>
  )
}
