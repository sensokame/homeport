import { useState, useEffect } from 'react'
import { NavBar } from '@homeport/ui'
import Overview from './pages/Overview'
import Detail from './pages/Detail'
import styles from './App.module.css'
import { getConfig } from './api'
import type { Config } from './types'

function getContainerName(hash: string): string | null {
  const m = hash.match(/^#\/container\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function App() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  const [config, setConfig] = useState<Config | null>(null)

  useEffect(() => {
    getConfig().then(setConfig)
    const handler = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const containerName = getContainerName(hash)

  return (
    <div className={styles.root}>
      <NavBar hostname={config?.hostname ?? '…'} />
      <main className={styles.main}>
        {containerName
          ? <Detail name={containerName} config={config} />
          : <Overview config={config} />
        }
      </main>
    </div>
  )
}
