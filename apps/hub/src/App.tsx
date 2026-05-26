import { useState, useEffect, useCallback } from 'react'
import { NavBar, WidgetCard, LinkCard } from '@homeport/ui'
import type { WidgetData } from '@homeport/ui'
import styles from './App.module.css'

interface Satellite {
  id: string
  name: string
  url: string
  widget_url?: string
  widget: WidgetData | null
}

interface Config {
  hostname: string
  version: string
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null)
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [cfg, sats] = await Promise.all([
        fetch('/api/config').then(r => r.json()),
        fetch('/api/satellites').then(r => r.json()),
      ])
      setConfig(cfg)
      setSatellites(sats)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 30_000)
    return () => clearInterval(timer)
  }, [fetchData])

  return (
    <div className={styles.root}>
      <NavBar hostname={config?.hostname ?? '…'} />
      <main className={styles.main}>
        {loading ? (
          <p className={styles.muted}>loading…</p>
        ) : satellites.length === 0 ? (
          <p className={styles.muted}>No satellites configured. Edit satellites.json to add services.</p>
        ) : (
          <div className={styles.grid}>
            {satellites.map(sat =>
              sat.widget ? (
                <WidgetCard key={sat.id} data={sat.widget} url={sat.url} />
              ) : (
                <LinkCard key={sat.id} name={sat.name} url={sat.url} />
              )
            )}
          </div>
        )}
      </main>
    </div>
  )
}
