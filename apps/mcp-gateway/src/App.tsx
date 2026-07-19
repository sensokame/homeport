import { useEffect, useState, useCallback } from 'react'
import { NavBar, Card, Badge } from '@homeport/ui'
import { getIntrospection } from './api'
import type { SatelliteIntrospection } from './types'
import styles from './App.module.css'

export default function App() {
  const [data, setData] = useState<SatelliteIntrospection[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    getIntrospection()
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div className={styles.root}>
      <NavBar hostname="MCP Gateway" />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Agent access layer</h1>
          <p className={styles.subtitle}>
            Every satellite that self-declares an <code>mcp</code> field in its <code>/api/catalog</code>,
            and what it currently exposes — live, not a static doc.
          </p>
          <button className={styles.refreshBtn} onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {data && data.length === 0 && (
          <p className={styles.empty}>No satellite currently declares an <code>mcp</code> field.</p>
        )}

        <div className={styles.grid}>
          {data?.map(sat => (
            <Card key={sat.satellite_id} status={sat.error ? 'error' : 'ok'} className={styles.satCard}>
              <div className={styles.satHeader}>
                <span className={styles.satName}>{sat.satellite_id}</span>
                <code className={styles.satUrl}>{sat.mcp_url}</code>
              </div>

              {sat.error && <div className={styles.satError}>{sat.error}</div>}

              {sat.resources.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Resources</h3>
                  {sat.resources.map(r => (
                    <div key={r.uri} className={styles.item}>
                      <code className={styles.itemName}>{r.uri}</code>
                      {r.description && <p className={styles.itemDesc}>{r.description}</p>}
                    </div>
                  ))}
                </div>
              )}

              {sat.tools.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Tools</h3>
                  {sat.tools.map(tool => (
                    <div key={tool.name} className={styles.item}>
                      <div className={styles.toolNameRow}>
                        <code className={styles.itemName}>{tool.name}</code>
                        {tool.annotations?.destructiveHint && <Badge label="mutates" variant="warn" />}
                        {tool.annotations?.readOnlyHint === false && !tool.annotations?.destructiveHint && (
                          <Badge label="write" variant="warn" />
                        )}
                      </div>
                      {tool.description && <p className={styles.itemDesc}>{tool.description}</p>}
                    </div>
                  ))}
                </div>
              )}

              {sat.resources.length === 0 && sat.tools.length === 0 && !sat.error && (
                <p className={styles.itemDesc}>Declares <code>mcp</code> but exposes nothing yet.</p>
              )}
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
