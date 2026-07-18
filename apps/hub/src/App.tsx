import { useState, useEffect, useCallback, Suspense } from 'react'
import { NavBar, StatusDot } from '@homeport/ui'
import { registry } from './registry'
import { TabBar } from './components/TabBar'
import { SettingsDrawer } from './components/SettingsDrawer'
import { WidgetShell } from './components/WidgetShell'
import { WidgetErrorBoundary } from './components/WidgetErrorBoundary'
import styles from './App.module.css'

interface SatelliteEntry {
  id: string
  url: string
}

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

function formatSlug(slug: string): string {
  return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function workspaceInstanceFromHash(): WidgetInstance | null {
  const m = window.location.hash.match(/^#\/workspace\/(.+)$/)
  if (!m) return null
  const slug = decodeURIComponent(m[1])
  return {
    instanceId: `workspace-hash-${slug}`,
    widgetId: 'workspace.panel',
    satelliteId: 'workspace',
    config: { mode: 'project', slug, label: formatSlug(slug) },
  }
}

export default function App() {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null)
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clock, setClock] = useState(() => fmtTime(new Date()))
  const [widgetStatuses, setWidgetStatuses] = useState<Record<string, 'ok' | 'warn' | 'error'>>({})
  const [focusedInstanceId, setFocusedInstanceId] = useState<string | null>(null)
  const [syntheticFocus, setSyntheticFocus] = useState<WidgetInstance | null>(() => workspaceInstanceFromHash())

  const exitFocus = useCallback(() => {
    setFocusedInstanceId(null)
    setSyntheticFocus(null)
    if (window.location.hash.startsWith('#/workspace/')) {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      const instance = workspaceInstanceFromHash()
      if (instance) setSyntheticFocus(instance)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const handleWidgetStatus = useCallback((instanceId: string, status: 'ok' | 'warn' | 'error') => {
    setWidgetStatuses(prev => ({ ...prev, [instanceId]: status }))
  }, [])

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ',' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSettingsOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (focusedInstanceId || syntheticFocus || !dashboard || dashboard.tabs.length < 2) return
    const ids = dashboard.tabs.map(t => t.id)
    let startX = 0, startY = 0, insideCard = false
    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      insideCard = !!(e.target as Element).closest?.('[data-swipeable]')
    }
    function onTouchEnd(e: TouchEvent) {
      if (insideCard) return
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
      setActiveTabId(prev => {
        const idx = ids.indexOf(prev ?? '')
        if (dx < 0 && idx < ids.length - 1) return ids[idx + 1]
        if (dx > 0 && idx > 0) return ids[idx - 1]
        return prev
      })
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [focusedInstanceId, dashboard])

  async function saveDashboard(updated: DashboardConfig) {
    setDashboard(updated)
    await fetch('/api/dashboard', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }

  async function handleRemoveWidget(tabId: string, instanceId: string) {
    if (!dashboard) return
    await saveDashboard({
      ...dashboard,
      tabs: dashboard.tabs.map(tab =>
        tab.id === tabId
          ? { ...tab, widgets: tab.widgets.filter(w => w.instanceId !== instanceId) }
          : tab
      ),
    })
  }

  async function handleAddTab(label: string) {
    if (!dashboard) return
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const id = `${slug}-${Date.now()}`
    const newTab: TabEntry = { id, label, widgets: [] }
    const updated = { ...dashboard, tabs: [...dashboard.tabs, newTab] }
    setActiveTabId(id)
    await saveDashboard(updated)
  }

  async function handleRenameTab(tabId: string, label: string) {
    if (!dashboard) return
    await saveDashboard({
      ...dashboard,
      tabs: dashboard.tabs.map(t => t.id === tabId ? { ...t, label } : t),
    })
  }

  async function handleDeleteTab(tabId: string) {
    if (!dashboard) return
    const updated = { ...dashboard, tabs: dashboard.tabs.filter(t => t.id !== tabId) }
    if (activeTabId === tabId) {
      setActiveTabId(updated.tabs[0]?.id ?? null)
    }
    await saveDashboard(updated)
  }

  async function handleAddWidget(tabId: string, widgetId: string, satelliteId?: string) {
    if (!dashboard) return
    const instanceId = widgetId.replace(/\./g, '-') + '-' + Date.now()
    const newWidget: WidgetInstance = {
      instanceId,
      widgetId,
      ...(satelliteId ? { satelliteId } : {}),
      config: {},
    }
    await saveDashboard({
      ...dashboard,
      tabs: dashboard.tabs.map(t =>
        t.id === tabId ? { ...t, widgets: [...t.widgets, newWidget] } : t
      ),
    })
  }

  async function handleDropWidget(fromTabId: string, fromIndex: number, toTabId: string, toIndex: number) {
    if (!dashboard) return
    const fromTab = dashboard.tabs.find(t => t.id === fromTabId)
    if (!fromTab) return
    const widget = fromTab.widgets[fromIndex]
    if (!widget) return

    let tabs: typeof dashboard.tabs
    if (fromTabId === toTabId) {
      if (fromIndex === toIndex) return
      const widgets = [...fromTab.widgets]
      widgets.splice(fromIndex, 1)
      // After removing the source item, indices > fromIndex shift left by 1
      const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex
      widgets.splice(insertAt, 0, widget)
      tabs = dashboard.tabs.map(t => t.id === fromTabId ? { ...t, widgets } : t)
    } else {
      const toTab = dashboard.tabs.find(t => t.id === toTabId)
      if (!toTab) return
      const fromWidgets = fromTab.widgets.filter((_, i) => i !== fromIndex)
      const toWidgets = [...toTab.widgets]
      toWidgets.splice(toIndex, 0, widget)
      tabs = dashboard.tabs.map(t => {
        if (t.id === fromTabId) return { ...t, widgets: fromWidgets }
        if (t.id === toTabId) return { ...t, widgets: toWidgets }
        return t
      })
    }
    await saveDashboard({ ...dashboard, tabs })
  }

  const activeTab = dashboard?.tabs.find(t => t.id === activeTabId) ?? null
  const satMap = Object.fromEntries((dashboard?.satellites ?? []).map(s => [s.id, s]))

  const renderWidget = (satelliteId: string, widgetId: string, config: Record<string, unknown>) => {
    const manifest = registry[widgetId]
    if (!manifest) return <div className={styles.missingWidget}>Unknown widget: {widgetId}</div>
    const sat = satMap[satelliteId]
    const Widget = manifest.component
    return (
      <WidgetErrorBoundary widgetId={widgetId}>
        <Suspense fallback={<div className={styles.missingWidget}>loading…</div>}>
          <Widget
            config={config}
            satelliteUrl={`/api/proxy/${satelliteId}`}
            publicUrl={sat?.url ?? ''}
            onStatusChange={() => {}}
          />
        </Suspense>
      </WidgetErrorBoundary>
    )
  }

  const allInstances = dashboard?.tabs.flatMap(t => t.widgets) ?? []
  const statusCounts = { ok: 0, warn: 0, error: 0 }
  for (const inst of allInstances) {
    const s = widgetStatuses[inst.instanceId] ?? 'ok'
    statusCounts[s]++
  }

  const focusedInstance = syntheticFocus ?? (focusedInstanceId
    ? (dashboard?.tabs.flatMap(t => t.widgets).find(w => w.instanceId === focusedInstanceId) ?? null)
    : null)

  return (
    <div className={styles.root}>
      <NavBar hostname={appConfig?.hostname ?? '…'} />
      {focusedInstance && (() => {
        const manifest = registry[focusedInstance.widgetId]
        if (!manifest) return null
        const sat = focusedInstance.satelliteId ? satMap[focusedInstance.satelliteId] : undefined
        const Widget = manifest.component
        return (
          <div className={styles.focusedWrapper}>
            <div className={styles.focusedHeader}>
              <span className={styles.focusedLabel}>focus mode</span>
              <button className={styles.exitFocusBtn} onClick={exitFocus}>← back</button>
            </div>
            <div className={styles.focusedContent}>
              <Suspense fallback={<p className={styles.muted}>loading…</p>}>
                <Widget
                  config={focusedInstance.config}
                  satelliteUrl={focusedInstance.satelliteId ? `/api/proxy/${focusedInstance.satelliteId}` : ''}
                  publicUrl={sat?.url ?? ''}
                  isFocused={true}
                  onStatusChange={() => {}}
                  renderWidget={renderWidget}
                />
              </Suspense>
            </div>
          </div>
        )
      })()}
      <div className={styles.hero} style={focusedInstance ? { display: 'none' } : undefined}>
        <div className={styles.heroInner}>
          <p className={styles.heroSub}>
            home server{appConfig?.version ? ` · v${appConfig.version}` : ''}
          </p>
          <div className={styles.heroRight}>
            <p className={styles.clock}>{clock}</p>
            {!loading && allInstances.length > 0 && (
              <div className={styles.ribbon}>
                <span className={styles.ribbonItem}><StatusDot status="ok" />{statusCounts.ok}</span>
                <span className={styles.ribbonItem}><StatusDot status="warn" />{statusCounts.warn}</span>
                <span className={styles.ribbonItem}><StatusDot status="error" />{statusCounts.error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {!focusedInstance && dashboard && dashboard.tabs.length > 0 && (
        <TabBar
          tabs={dashboard.tabs}
          activeId={activeTabId ?? dashboard.tabs[0].id}
          onSelect={setActiveTabId}
          onSettingsOpen={() => setSettingsOpen(true)}
        />
      )}
      <main className={styles.main} style={focusedInstance ? { display: 'none' } : undefined}>
        {loading ? (
          <p className={styles.muted}>loading…</p>
        ) : (
          <div className={styles.content}>
            {dashboard?.tabs.map(tab => {
              const isActive = tab.id === activeTabId
              if (tab.widgets.length === 0) {
                return isActive ? (
                  <p key={tab.id} className={styles.muted}>No widgets on this tab. Open settings to add some.</p>
                ) : null
              }
              return (
                <div key={tab.id} className={styles.grid} style={isActive ? undefined : { display: 'none' }}>
                  {tab.widgets.map(instance => {
                    const manifest = registry[instance.widgetId]
                    if (!manifest) {
                      return (
                        <div key={instance.instanceId} className={styles.missingWidget}>
                          Unknown widget: {instance.widgetId}
                        </div>
                      )
                    }
                    const sat = instance.satelliteId ? satMap[instance.satelliteId] : undefined
                    return (
                      <WidgetErrorBoundary key={instance.instanceId} widgetId={instance.widgetId}>
                      <Suspense fallback={<div className={styles.missingWidget}>loading…</div>}>
                        <WidgetShell
                          manifest={manifest}
                          instance={instance}
                          satelliteUrl={instance.satelliteId ? `/api/proxy/${instance.satelliteId}` : ''}
                          publicUrl={sat?.url ?? ''}
                          onStatusChange={(s) => handleWidgetStatus(instance.instanceId, s)}
                          onFocusRequest={() => setFocusedInstanceId(instance.instanceId)}
                          renderWidget={renderWidget}
                        />
                      </Suspense>
                      </WidgetErrorBoundary>
                    )
                  })}
                </div>
              )
            })}
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
          onAddTab={handleAddTab}
          onRenameTab={handleRenameTab}
          onDeleteTab={handleDeleteTab}
          onAddWidget={handleAddWidget}
          onDropWidget={handleDropWidget}
        />
      )}
    </div>
  )
}
