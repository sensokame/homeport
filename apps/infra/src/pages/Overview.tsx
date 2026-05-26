import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, StatusDot, MetricBar, Button } from '@homeport/ui'
import type { Container, ContainerStats, SystemStats, Config } from '../types'
import {
  getContainers, getSystem, getStats, containerAction,
  restartAll, updateAll, getUpdateStatus, formatBytes, formatUptime,
} from '../api'
import styles from './Overview.module.css'

interface OverviewProps {
  config: Config | null
}

export default function Overview({ config }: OverviewProps) {
  const [containers, setContainers] = useState<Container[]>([])
  const [system, setSystem]         = useState<SystemStats | null>(null)
  const [stats, setStats]           = useState<Record<string, ContainerStats>>({})
  const [loading, setLoading]       = useState(true)
  const [updating, setUpdating]     = useState(false)
  const [updateMsg, setUpdateMsg]   = useState('')
  const updatePollRef               = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadOverview = useCallback(async () => {
    const [c, s] = await Promise.all([getContainers(), getSystem()])
    setContainers(c)
    setSystem(s)
    setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    const running = containers.filter(c => c.status === 'running')
    const results = await Promise.allSettled(running.map(c => getStats(c.name)))
    const map: Record<string, ContainerStats> = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') map[running[i].name] = r.value
    })
    setStats(map)
  }, [containers])

  useEffect(() => {
    loadOverview()
    const overviewTimer = setInterval(loadOverview, 5000)
    return () => clearInterval(overviewTimer)
  }, [loadOverview])

  useEffect(() => {
    if (containers.length === 0) return
    loadStats()
    const statsTimer = setInterval(loadStats, 12000)
    return () => clearInterval(statsTimer)
  }, [loadStats, containers.length])

  const handleAction = async (name: string, action: string) => {
    await containerAction(name, action)
    setTimeout(loadOverview, 1000)
  }

  const handleRestartAll = async () => {
    if (!confirm('Restart all containers? (infra will not restart itself)')) return
    const r = await restartAll()
    setUpdateMsg(`Restarted ${r.count} containers`)
    setTimeout(() => setUpdateMsg(''), 5000)
    setTimeout(loadOverview, 2000)
  }

  const handleUpdateAll = async () => {
    if (!confirm('Pull latest images for all containers and restart those that changed?')) return
    const r = await updateAll()
    if (!r.ok) { setUpdateMsg(r.reason ?? 'already running'); return }
    setUpdating(true)
    setUpdateMsg('Pulling images…')
    updatePollRef.current = setInterval(async () => {
      const s = await getUpdateStatus()
      if (!s.running) {
        clearInterval(updatePollRef.current!)
        setUpdating(false)
        const updated  = s.results.filter(r => r.status === 'updated').length
        const upToDate = s.results.filter(r => r.status === 'up-to-date').length
        const errors   = s.results.filter(r => r.status === 'error').length
        setUpdateMsg(`${updated} updated, ${upToDate} up-to-date${errors ? `, ${errors} errors` : ''}`)
        setTimeout(() => setUpdateMsg(''), 8000)
        if (updated > 0) loadOverview()
      } else {
        setUpdateMsg(`Pulling… (${s.results.length} done)`)
      }
    }, 2000)
  }

  const running = containers.filter(c => c.status === 'running').length
  const sorted  = [...containers].sort((a, b) =>
    (a.status === 'running' ? -1 : 1) - (b.status === 'running' ? -1 : 1) || a.name.localeCompare(b.name)
  )

  return (
    <div className={styles.root}>
      <div className={styles.body}>
        {system && (
          <div className={styles.metrics}>
            <MetricBar label="CPU"  value={`${system.cpu_percent}%`}  percent={system.cpu_percent} />
            <MetricBar label="RAM"  value={`${formatBytes(system.mem_used)} / ${formatBytes(system.mem_total)}`} percent={system.mem_percent} />
            <MetricBar label="Disk" value={`${system.disk_percent}%`} percent={system.disk_percent} />
          </div>
        )}

        <p className={styles.summary}>
          {loading ? 'Loading…' : `${running} / ${containers.length} running`}
        </p>

        <div className={styles.grid}>
          {sorted.map(c => {
            const s = stats[c.name]
            const isRunning = c.status === 'running'
            const dozzleHref = config?.dozzle_url ? `${config.dozzle_url}/container/${c.id}` : undefined
            return (
              <Card
                key={c.name}
                status={isRunning ? 'ok' : c.status === 'restarting' ? 'warn' : 'error'}
                className={styles.card}
                onClick={() => { window.location.hash = `#/container/${encodeURIComponent(c.name)}` }}
              >
                <div className={styles.cardHeader}>
                  <StatusDot status={isRunning ? 'ok' : c.status === 'restarting' ? 'warn' : 'error'} />
                  <span className={styles.cardName}>{c.name}</span>
                </div>
                <div className={styles.cardImage}>{c.image.replace(/:latest$/, '')}</div>
                <div className={styles.cardMeta}>
                  {isRunning
                    ? <><span>up {formatUptime(c.started)}</span>{s && <><span>cpu {s.cpu_percent}%</span><span>{formatBytes(s.mem_usage)}</span></>}</>
                    : <span>{c.status}</span>
                  }
                </div>
                <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                  {isRunning ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => handleAction(c.name, 'restart')}>restart</Button>
                      <Button size="sm" variant="danger" onClick={() => handleAction(c.name, 'stop')}>stop</Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => handleAction(c.name, 'start')}>start</Button>
                  )}
                  {dozzleHref && (
                    <a className={styles.logsLink} href={dozzleHref} target="_blank" rel="noopener">logs →</a>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      <div className={styles.bottomBar}>
        <Button variant="ghost" onClick={handleRestartAll}>restart all</Button>
        <Button variant="ghost" disabled={updating} onClick={handleUpdateAll}>
          {updating ? 'updating…' : 'update all'}
        </Button>
        {updateMsg && <span className={styles.updateMsg}>{updateMsg}</span>}
      </div>
    </div>
  )
}
