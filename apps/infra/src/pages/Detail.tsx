import { useState, useEffect } from 'react'
import { StatusDot, Button } from '@homeport/ui'
import type { ContainerDetail, ContainerStats, Config } from '../types'
import { getContainer, getStats, containerAction, formatBytes, formatUptime } from '../api'
import styles from './Detail.module.css'

interface DetailProps {
  name: string
  config: Config | null
}

export default function Detail({ name, config }: DetailProps) {
  const [container, setContainer] = useState<ContainerDetail | null>(null)
  const [stats, setStats]         = useState<ContainerStats | null>(null)
  const [acting, setActing]       = useState(false)

  useEffect(() => {
    getContainer(name).then(setContainer)
  }, [name])

  useEffect(() => {
    if (!container || container.status !== 'running') return
    const load = () => getStats(name).then(setStats)
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [name, container?.status])

  const handleAction = async (action: string) => {
    setActing(true)
    try {
      await containerAction(name, action)
      await new Promise(r => setTimeout(r, 1200))
      const updated = await getContainer(name)
      setContainer(updated)
    } finally { setActing(false) }
  }

  const back = () => { window.location.hash = '#/' }

  if (!container) return <div className={styles.root}><p className={styles.muted}>Loading…</p></div>

  const isRunning = container.status === 'running'
  const ports = Object.entries(container.ports ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${v![0].HostPort} → ${k}`)
    .join(', ') || '—'

  const dozzleHref = config?.dozzle_url ? `${config.dozzle_url}/container/${container.id}` : undefined

  return (
    <div className={styles.root}>
      <a className={styles.back} href="#/" onClick={e => { e.preventDefault(); back() }}>← back</a>

      <div className={styles.header}>
        <StatusDot status={isRunning ? 'ok' : container.status === 'restarting' ? 'warn' : 'error'} />
        <span className={styles.name}>{container.name}</span>
      </div>

      <table className={styles.table}>
        <tbody>
          <tr><td>image</td>    <td className={styles.mono}>{container.image}</td></tr>
          <tr><td>started</td>  <td>{isRunning ? `${formatUptime(container.started)} ago` : '—'}</td></tr>
          <tr><td>restart</td>  <td>{container.restart_policy || 'none'}</td></tr>
          <tr><td>ports</td>    <td className={styles.mono}>{ports}</td></tr>
          <tr><td>networks</td> <td>{container.networks.join(', ') || '—'}</td></tr>
          {container.mounts.map((m, i) => (
            <tr key={i}><td>{i === 0 ? 'mounts' : ''}</td><td className={styles.mono}>{m}</td></tr>
          ))}
        </tbody>
      </table>

      {stats && isRunning && (
        <div className={styles.statsBar}>
          <div className={styles.stat}><span className={styles.statLabel}>CPU</span><span className={styles.statValue}>{stats.cpu_percent}%</span></div>
          <div className={styles.stat}><span className={styles.statLabel}>RAM</span><span className={styles.statValue}>{formatBytes(stats.mem_usage)} / {formatBytes(stats.mem_limit)}</span></div>
          <div className={styles.stat}><span className={styles.statLabel}>NET ↑</span><span className={styles.statValue}>{formatBytes(stats.net_tx)}</span></div>
          <div className={styles.stat}><span className={styles.statLabel}>NET ↓</span><span className={styles.statValue}>{formatBytes(stats.net_rx)}</span></div>
        </div>
      )}

      <div className={styles.actions}>
        {isRunning ? (
          <>
            <Button disabled={acting} onClick={() => handleAction('restart')}>restart</Button>
            <Button variant="danger" disabled={acting} onClick={() => handleAction('stop')}>stop</Button>
          </>
        ) : (
          <Button disabled={acting} onClick={() => handleAction('start')}>start</Button>
        )}
      </div>

      {dozzleHref && (
        <a className={styles.dozzle} href={dozzleHref} target="_blank" rel="noopener">view logs in Dozzle →</a>
      )}
    </div>
  )
}
