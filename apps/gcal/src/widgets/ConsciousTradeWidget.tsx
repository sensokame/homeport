import { useEffect, useState } from 'react'
import type { WidgetProps } from '@homeport/ui'
import styles from './ConsciousTradeWidget.module.css'

interface CalEvent {
  id: string
  title: string
  start: string
  end: string
  start_time: string
  end_time: string
}

interface WidgetData {
  configured: boolean
  current: (CalEvent & { traded: boolean }) | null
  next: CalEvent | null
}

interface FocusData {
  fields: Record<string, string[]>
  today: string | null
}

function timeRemaining(endIso: string): string {
  const diff = new Date(endIso).getTime() - Date.now()
  if (diff <= 0) return 'done'
  const totalMin = Math.floor(diff / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function blockProgress(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  return Math.min(100, Math.max(0, (Date.now() - start) / (end - start) * 100))
}

export function ConsciousTradeWidget({ satelliteUrl, onStatusChange, onFocusRequest, isFocused }: WidgetProps) {
  const [data, setData] = useState<WidgetData | null>(null)
  const [focus, setFocus] = useState<FocusData>({ fields: {}, today: null })
  const [loading, setLoading] = useState(true)
  const [traded, setTraded] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    Promise.all([
      fetch(`${satelliteUrl}/widget`).then(r => r.json()),
      fetch(`${satelliteUrl}/api/focus`).then(r => r.json()),
    ])
      .then(([d, f]: [WidgetData, FocusData]) => {
        setData(d)
        setTraded(d.current?.traded ?? false)
        setFocus(f)
        onStatusChange?.(d.configured ? 'ok' : 'warn')
      })
      .catch(() => onStatusChange?.('error'))
      .finally(() => setLoading(false))
  }, [satelliteUrl])

  useEffect(() => {
    if (!isFocused) return
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [isFocused])

  async function handleTrade() {
    if (!data?.current) return
    await fetch(`${satelliteUrl}/api/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: data.current.id, event_title: data.current.title }),
    })
    setTraded(true)
  }

  if (loading) return <div className={styles.panel}><p className={styles.muted}>Loading…</p></div>

  if (!data?.configured) {
    return (
      <div className={styles.panel}>
        <p className={styles.muted}>Set GCAL_ICS_URL to enable.</p>
      </div>
    )
  }

  if (isFocused && data.current) {
    const remaining = timeRemaining(data.current.end)
    const progress = blockProgress(data.current.start, data.current.end)
    const focusFields = Object.entries(focus.fields)
    return (
      <div className={styles.focusedPanel}>
        <div className={styles.focusedBlock}>
          <span className={styles.focusedMeta}>in progress</span>
          <h1 className={styles.focusedTitle}>{data.current.title}</h1>
          <p className={styles.focusedTime}>{data.current.start_time} – {data.current.end_time}</p>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <p className={styles.remaining}>{remaining} {remaining !== 'done' ? 'remaining' : ''}</p>
          {(focusFields.length > 0 || focus.today) && (
            <div className={styles.focusedFields}>
              {focusFields.map(([key, values]) => (
                <div key={key} className={styles.focusedField}>
                  <span className={styles.focusedFieldKey}>{key}</span>
                  <span className={styles.focusedFieldVal}>{values.join(', ')}</span>
                </div>
              ))}
              {focus.today && (
                <div className={styles.focusedField}>
                  <span className={styles.focusedFieldKey}>today</span>
                  <span className={styles.focusedFieldVal}>{focus.today}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {(focus.fields.project?.length || focus.today) && (
        <div className={styles.section}>
          <span className={styles.label}>focus</span>
          {focus.fields.project?.map(p => (
            <p key={p} className={styles.focusProject}>{p}</p>
          ))}
          {focus.today && <p className={styles.focusNote}>{focus.today}</p>}
        </div>
      )}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.label}>now</span>
          {data.current && onFocusRequest && (
            <button className={styles.focusBtn} onClick={onFocusRequest}>focus →</button>
          )}
        </div>
        {data.current ? (
          <>
            <p className={styles.eventTitle} data-traded={traded}>{data.current.title}</p>
            <p className={styles.eventTime}>{data.current.start_time} – {data.current.end_time}</p>
            {!traded ? (
              <button className={styles.tradeBtn} onClick={handleTrade}>
                Trading for project work →
              </button>
            ) : (
              <span className={styles.tradedBadge}>✓ traded</span>
            )}
          </>
        ) : (
          <p className={styles.muted}>No active block</p>
        )}
      </div>
      {data.next && (
        <div className={styles.section}>
          <span className={styles.label}>next</span>
          <p className={styles.eventTitle}>{data.next.title}</p>
          <p className={styles.eventTime}>{data.next.start_time}</p>
        </div>
      )}
    </div>
  )
}
