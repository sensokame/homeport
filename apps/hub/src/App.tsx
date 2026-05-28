import { useState, useEffect, useCallback } from 'react'
import { NavBar, WidgetCard, LinkCard } from '@homeport/ui'
import type { WidgetData } from '@homeport/ui'
import {
  Book, BookOpen, CheckSquare, DollarSign, Server, Package,
  Globe, Database, Folder, Settings, Activity, type LucideProps,
} from 'lucide-react'
import styles from './App.module.css'

type IconName = string
type IconComponent = React.ComponentType<LucideProps>

const ICON_MAP: Record<string, IconComponent> = {
  'book':         Book,
  'book-open':    BookOpen,
  'check-square': CheckSquare,
  'dollar-sign':  DollarSign,
  'server':       Server,
  'package':      Package,
  'globe':        Globe,
  'database':     Database,
  'folder':       Folder,
  'settings':     Settings,
  'activity':     Activity,
}

function resolveIcon(name: IconName | undefined) {
  if (!name) return undefined
  const Icon = ICON_MAP[name]
  return Icon ? <Icon size={20} strokeWidth={1.5} /> : undefined
}

interface Satellite {
  id: string
  name: string
  url: string
  icon?: string
  widget_url?: string
  widget: WidgetData | null
}

interface Config {
  hostname: string
  version: string
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null)
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [clock, setClock] = useState(() => fmtTime(new Date()))

  const fetchData = useCallback(async () => {
    try {
      const [cfg, sats] = await Promise.all([
        fetch('/api/config').then(r => r.json()),
        fetch('/api/satellites').then(r => r.json()),
      ])
      setConfig(cfg)
      setSatellites(sats)
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 30_000)
    return () => clearInterval(timer)
  }, [fetchData])

  useEffect(() => {
    const timer = setInterval(() => setClock(fmtTime(new Date())), 1000)
    return () => clearInterval(timer)
  }, [])

  const widgetSats = satellites.filter(s => s.widget !== null)
  const linkSats = satellites.filter(s => s.widget === null)

  const statusCounts = widgetSats.reduce(
    (acc, s) => { acc[s.widget!.status] = (acc[s.widget!.status] ?? 0) + 1; return acc },
    { ok: 0, warn: 0, error: 0 } as Record<string, number>
  )

  return (
    <div className={styles.root}>
      <NavBar hostname={config?.hostname ?? '…'} />
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.heroSub}>
            home server{config?.version ? ` · v${config.version}` : ''}
          </p>
          {!loading && widgetSats.length > 0 && (
            <div className={styles.heroRight}>
              <div className={styles.statusRow}>
                <span className={`${styles.badge} ${styles.badgeOk}`}>● {statusCounts.ok} ok</span>
                <span className={`${styles.badge} ${styles.badgeWarn}`}>⚠ {statusCounts.warn} warn</span>
                <span className={`${styles.badge} ${styles.badgeError}`}>✕ {statusCounts.error} error</span>
              </div>
              <p className={styles.clock}>{clock}</p>
              {lastUpdated && (
                <p className={styles.updated}>refreshed {fmtTime(lastUpdated)} · every 30s</p>
              )}
            </div>
          )}
        </div>
      </div>
      <main className={styles.main}>
        {loading ? (
          <p className={styles.muted}>loading…</p>
        ) : satellites.length === 0 ? (
          <p className={styles.muted}>No satellites configured. Edit satellites.json to add services.</p>
        ) : (
          <div className={styles.content}>
            {widgetSats.length > 0 && (
              <section>
                {linkSats.length > 0 && <h2 className={styles.sectionTitle}>Services</h2>}
                <div className={styles.grid}>
                  {widgetSats.map(sat => (
                    <WidgetCard key={sat.id} data={sat.widget as WidgetData} url={sat.url} icon={resolveIcon(sat.icon)} />
                  ))}
                </div>
              </section>
            )}
            {linkSats.length > 0 && (
              <section>
                {widgetSats.length > 0 && <h2 className={styles.sectionTitle}>Links</h2>}
                <div className={`${styles.grid} ${styles.gridCompact}`}>
                  {linkSats.map(sat => (
                    <LinkCard key={sat.id} name={sat.name} url={sat.url} icon={resolveIcon(sat.icon)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
