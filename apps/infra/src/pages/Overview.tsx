import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, StatusDot, MetricBar, Button, Modal } from '@homeport/ui'
import type { Container, ContainerStats, SystemStats, Config, HealthResponse, CheckLevel } from '../types'
import {
  getContainers, getSystem, getAllStats, containerAction, redeployContainer, groupAction,
  restartAll, updateAll, getUpdateStatus, getHealth, startIntegrityScan, getScanStatus, formatBytes, formatUptime,
} from '../api'
import styles from './Overview.module.css'

interface OverviewProps {
  config: Config | null
}

const GROUP_ORDER = ['orchestrator', 'public', 'internal'] as const
const GROUP_LABELS: Record<string, string> = {
  orchestrator: 'Orchestrators',
  public:       'Public',
  internal:     'Internal',
}

const LEVEL_ORDER: Record<CheckLevel, number> = { error: 0, warn: 1, ok: 2 }

export default function Overview({ config }: OverviewProps) {
  const [containers, setContainers] = useState<Container[]>([])
  const [system, setSystem]         = useState<SystemStats | null>(null)
  const [stats, setStats]           = useState<Record<string, ContainerStats>>({})
  const [loading, setLoading]       = useState(true)
  const [updating, setUpdating]     = useState(false)
  const [updateMsg, setUpdateMsg]   = useState('')
  const [dialog, setDialog]         = useState<{ message: string; onConfirm: () => void } | null>(null)
  const updatePollRef               = useRef<ReturnType<typeof setInterval> | null>(null)
  const [health, setHealth]         = useState<HealthResponse | null>(null)
  const [scanning, setScanning]     = useState(false)
  const [scanMsg, setScanMsg]       = useState('')
  const scanPollRef                 = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadOverview = useCallback(async () => {
    const [c, s] = await Promise.all([getContainers(), getSystem()])
    setContainers(c)
    setSystem(s)
    setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    if (containers.filter(c => c.status === 'running').length === 0) return
    const map = await getAllStats()
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

  const loadHealth = useCallback(async () => {
    const h = await getHealth()
    setHealth(h)
    setScanning(h.scan_running)
  }, [])

  useEffect(() => {
    loadHealth()
    const healthTimer = setInterval(loadHealth, 30000)
    return () => clearInterval(healthTimer)
  }, [loadHealth])

  const handleRunScan = () => {
    setDialog({
      message: 'Run a full package integrity scan (dpkg --verify)? Takes about 30 seconds.',
      onConfirm: async () => {
        const r = await startIntegrityScan()
        if (!r.ok) { setScanMsg(r.reason ?? 'already running'); return }
        setScanning(true)
        setScanMsg('Scanning…')
        scanPollRef.current = setInterval(async () => {
          const s = await getScanStatus()
          if (!s.running) {
            clearInterval(scanPollRef.current!)
            setScanning(false)
            setScanMsg(s.integrity?.clean ? 'Scan clean' : `Scan found ${s.integrity?.findings.length ?? 0} issue(s)`)
            setTimeout(() => setScanMsg(''), 8000)
            loadHealth()
          }
        }, 3000)
      },
    })
  }

  const handleAction = async (name: string, action: string) => {
    await containerAction(name, action)
    setTimeout(loadOverview, 1000)
  }

  const handleRedeploy = (name: string) => {
    setDialog({
      message: `Redeploy ${name}? The container will be recreated from its compose config.`,
      onConfirm: async () => {
        await redeployContainer(name)
        setTimeout(loadOverview, 2500)
      },
    })
  }

  const handleGroupAction = (group: string, action: string, label: string) => {
    const messages: Record<string, string> = {
      restart:  `Restart all containers in ${label}?`,
      stop:     `Stop all containers in ${label}?`,
      start:    `Start all containers in ${label}?`,
      redeploy: `Redeploy all containers in ${label}? Each will be recreated from its compose config.`,
    }
    setDialog({
      message: messages[action],
      onConfirm: async () => {
        await groupAction(group, action)
        setTimeout(loadOverview, 1000)
      },
    })
  }

  const handleRestartAll = () => {
    setDialog({
      message: 'Restart all containers? (infra will not restart itself)',
      onConfirm: async () => {
        const r = await restartAll()
        setUpdateMsg(`Restarted ${r.count} containers`)
        setTimeout(() => setUpdateMsg(''), 5000)
        setTimeout(loadOverview, 2000)
      },
    })
  }

  const handleUpdateAll = () => {
    setDialog({
      message: 'Pull latest images for all containers and restart those that changed?',
      onConfirm: async () => {
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
      },
    })
  }

  const running = containers.filter(c => c.status === 'running').length
  const sorted  = [...containers].sort((a, b) =>
    (a.status === 'running' ? -1 : 1) - (b.status === 'running' ? -1 : 1) || a.name.localeCompare(b.name)
  )

  const hasGroups = sorted.some(c => c.group)
  const sections = hasGroups
    ? [
        ...GROUP_ORDER
          .map(key => ({ key, label: GROUP_LABELS[key], containers: sorted.filter(c => c.group === key) }))
          .filter(s => s.containers.length > 0),
        { key: 'other', label: 'Other', containers: sorted.filter(c => !c.group || !GROUP_ORDER.includes(c.group as typeof GROUP_ORDER[number])) },
      ].filter(s => s.containers.length > 0)
    : [{ key: 'all', label: '', containers: sorted }]

  const renderCard = (c: Container) => {
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
          <Button size="sm" variant="secondary" className={styles.cardRedeployBtn}
            onClick={e => { e.stopPropagation(); handleRedeploy(c.name) }}>redeploy</Button>
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
          {(dozzleHref || c.url) && (
            <div className={styles.linkGroup}>
              {c.url && (
                <a className={styles.openLink} href={c.url} target="_blank" rel="noopener">open →</a>
              )}
              {dozzleHref && (
                <a className={styles.logsLink} href={dozzleHref} target="_blank" rel="noopener">logs →</a>
              )}
            </div>
          )}
        </div>
      </Card>
    )
  }

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

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Health & Security</span>
            <div className={styles.sectionActions}>
              <Button size="sm" variant="ghost" disabled={scanning} onClick={handleRunScan}>
                {scanning ? 'scanning…' : 'run integrity scan'}
              </Button>
            </div>
          </div>

          {health?.status ? (
            <div className={styles.healthGrid}>
              <Card className={styles.healthCard}>
                <span className={styles.healthLabel}>Disk SMART</span>
                <span className={[styles.healthValue, health.status.smart?.passed === false ? styles.healthAlert : ''].filter(Boolean).join(' ')}>
                  {health.status.smart?.passed == null ? '—' : health.status.smart.passed ? 'OK' : 'FAILED'}
                </span>
                <span className={styles.healthMeta}>
                  {[
                    health.status.smart?.temperature_c != null ? `${health.status.smart.temperature_c}°C` : null,
                    health.status.smart?.media_errors != null ? `${health.status.smart.media_errors} media errors` : null,
                    health.status.smart?.unsafe_shutdowns != null ? `${health.status.smart.unsafe_shutdowns} unsafe shutdowns` : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              </Card>
              <Card className={styles.healthCard}>
                <span className={styles.healthLabel}>fail2ban (sshd)</span>
                <span className={[styles.healthValue, (health.status.fail2ban?.currently_banned ?? 0) > 0 ? styles.healthAlert : ''].filter(Boolean).join(' ')}>
                  {health.status.fail2ban?.currently_banned ?? '—'} banned
                </span>
                <span className={styles.healthMeta}>{health.status.fail2ban?.total_banned ?? 0} total bans</span>
              </Card>
              <Card className={styles.healthCard}>
                <span className={styles.healthLabel}>Pending updates</span>
                <span className={styles.healthValue}>{health.status.apt.upgradable_total}</span>
                <span className={styles.healthMeta}>{health.status.apt.upgradable_security} security</span>
              </Card>
            </div>
          ) : (
            <p className={styles.muted}>No health data yet</p>
          )}

          {health?.stale && <p className={styles.updateMsg}>Data is stale — host health-check timer may not be running.</p>}

          {health?.integrity && (
            <div className={styles.integrityBlock}>
              <p className={styles.summary}>
                Last integrity scan: {new Date(health.integrity.finished_at).toLocaleString()} —{' '}
                {health.integrity.clean ? 'clean' : `${health.integrity.findings.length} finding(s)`}
              </p>
              {!health.integrity.clean && (
                <div className={styles.findingsList}>
                  {health.integrity.findings.map((f, i) => (
                    <div key={i} className={[styles.findingRow, f.kind === 'modified' ? styles.findingModified : ''].filter(Boolean).join(' ')}>
                      <span className={styles.findingFlags}>{f.kind === 'modified' ? f.flags.trim() : 'missing'}</span>
                      <span className={styles.findingPath}>{f.path}</span>
                      <span className={styles.findingPackage}>{f.package}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {scanMsg && <p className={styles.updateMsg}>{scanMsg}</p>}

          {health?.checks && (
            <div className={styles.integrityBlock}>
              <p className={styles.summary}>
                Checks (last run {new Date(health.checks.checked_at).toLocaleString()})
              </p>
              <div className={styles.findingsList}>
                {Object.entries(health.checks.checks)
                  .sort(([a, x], [b, y]) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level] || a.localeCompare(b))
                  .map(([id, c]) => (
                    <div key={id} className={styles.checkRow} title={`${id} · since ${new Date(c.since).toLocaleString()}`}>
                      <span className={[styles.checkDot, styles[`check_${c.level}`]].join(' ')} />
                      <span className={styles.checkLabel}>{c.label}</span>
                      <span className={styles.checkDetail}>{c.detail}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {sections.map(section => (
          <div key={section.key} className={styles.section}>
            {section.label && (
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>{section.label}</span>
                {section.key !== 'other' && (
                  <div className={styles.sectionActions}>
                    <Button size="sm" variant="ghost" onClick={() => handleGroupAction(section.key, 'restart', section.label)}>restart</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleGroupAction(section.key, 'stop', section.label)}>stop</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleGroupAction(section.key, 'start', section.label)}>start</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleGroupAction(section.key, 'redeploy', section.label)}>redeploy</Button>
                  </div>
                )}
              </div>
            )}
            <div className={styles.grid}>
              {section.containers.map(renderCard)}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.bottomBar}>
        <Button variant="ghost" onClick={handleRestartAll}>restart all</Button>
        <Button variant="ghost" disabled={updating} onClick={handleUpdateAll}>
          {updating ? 'updating…' : 'update all'}
        </Button>
        {updateMsg && <span className={styles.updateMsg}>{updateMsg}</span>}
      </div>

      {dialog && (
        <Modal title="Confirm" onClose={() => setDialog(null)}>
          <p className={styles.dialogMessage}>{dialog.message}</p>
          <div className={styles.dialogActions}>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={() => { setDialog(null); dialog.onConfirm() }}>Confirm</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
