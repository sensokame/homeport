import { useState, useEffect, useCallback } from 'react'
import { NavBar } from '@homeport/ui'
import { registry } from './registry'
import { TabBar } from './components/TabBar'
import { SettingsDrawer } from './components/SettingsDrawer'
import { WidgetShell } from './components/WidgetShell'
import styles from './App.module.css'

interface SatelliteEntry {
  id: string
  url: string
}

interface WidgetInstance {
  instanceId: string
  widgetId: string
  satelliteId: string
  config: Record<string, unknown>
}

interface TabEntry {
  id: string
  label: string
  widgets: WidgetInstance[]
}

interface DashboardConfig {
  version: number
  satellites: SatelliteEntry[]
  tabs: TabEntry[]
}

interface AppConfig {
  hostname: string
  version: string
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function App() {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null)
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clock, setClock] = useState(() => fmtTime(new Date()))

  const fetchData = useCallback(async () => {
    try {
      const [cfg, dash] = await Promise.all([
        fetch('/api/config').then(r => r.json()),
        fetch('/api/dashboard').then(r => r.json()),
      ])
      setAppConfig(cfg)
      setDashboard(dash)
      setActiveTabId(prev => prev ?? dash.tabs[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const timer = setInterval(() => setClock(fmtTime(new Date())), 1000)
    return () => clearInterval(timer)
  }, [])

  async function handleRemoveWidget(tabId: string, instanceId: string) {
    if (!dashboard) return
    const updated: DashboardConfig = {
      ...dashboard,
      tabs: dashboard.tabs.map(tab =>
        tab.id === tabId
          ? { ...tab, widgets: tab.widgets.filter(w => w.instanceId !== instanceId) }
          : tab
      ),
    }
    setDashboard(updated)
    await fetch('/api/dashboard', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  const activeTab = dashboard?.tabs.find(t => t.id === activeTabId) ?? null
  const satMap = Object.fromEntries((dashboard?.satellites ?? []).map(s => [s.id, s]))

  return (
    <div className={styles.root}>
      <NavBar hostname={appConfig?.hostname ?? '…'} />
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.heroSub}>
            home server{appConfig?.version ? ` · v${appConfig.version}` : ''}
          </p>
          <div className={styles.heroRight}>
            <p className={styles.clock}>{clock}</p>
          </div>
        </div>
      </div>
      {dashboard && dashboard.tabs.length > 0 && (
        <TabBar
          tabs={dashboard.tabs}
          activeId={activeTabId ?? dashboard.tabs[0].id}
          onSelect={setActiveTabId}
          onSettingsOpen={() => setSettingsOpen(true)}
        />
      )}
      <main className={styles.main}>
        {loading ? (
          <p className={styles.muted}>loading…</p>
        ) : !activeTab || activeTab.widgets.length === 0 ? (
          <p className={styles.muted}>No widgets on this tab. Open settings to add some.</p>
        ) : (
          <div className={styles.content}>
            <div className={styles.grid}>
              {activeTab.widgets.map(instance => {
                const manifest = registry[instance.widgetId]
                if (!manifest) {
                  return (
                    <div key={instance.instanceId} className={styles.missingWidget}>
                      Unknown widget: {instance.widgetId}
                    </div>
                  )
                }
                const sat = satMap[instance.satelliteId]
                return (
                  <WidgetShell
                    key={instance.instanceId}
                    manifest={manifest}
                    instance={instance}
                    satelliteUrl={`/api/proxy/${instance.satelliteId}`}
                    publicUrl={sat?.url ?? ''}
                  />
                )
              })}
            </div>
          </div>
        )}
      </main>
      {dashboard && (
        <SettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          tabs={dashboard.tabs}
          registry={registry}
          onRemoveWidget={handleRemoveWidget}
        />
      )}
    </div>
  )
}
