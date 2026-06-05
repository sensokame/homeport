import { useState, useEffect } from 'react'
import { NavBar } from '@homeport/ui'
import { fetchStatus, fetchTodayEvents, recordTrade } from './api'
import type { CalendarEvent } from './types'
import styles from './App.module.css'

function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function isCurrentEvent(event: CalendarEvent): boolean {
  const now = new Date()
  return new Date(event.start) <= now && now < new Date(event.end)
}

export default function App() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [traded, setTraded] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchStatus()
      .then(({ configured }) => {
        setConfigured(configured)
        if (configured) return fetchTodayEvents()
        return null
      })
      .then(data => {
        if (data) {
          setEvents(data.events)
          setTraded(new Set(data.events.filter(e => e.traded).map(e => e.id)))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleTrade(event: CalendarEvent) {
    await recordTrade(event.id, event.title)
    setTraded(prev => new Set([...prev, event.id]))
  }

  return (
    <div className={styles.root}>
      <NavBar hostname="calendar" links={[]} />
      <main className={styles.main}>
        {loading ? (
          <p className={styles.muted}>Loading…</p>
        ) : !configured ? (
          <div className={styles.setup}>
            <p className={styles.setupTitle}>Calendar not configured</p>
            <p className={styles.muted}>
              Set <code>GCAL_ICS_URL</code> in <code>/opt/station/.env</code> to your
              calendar's secret iCal address.
            </p>
            <p className={styles.muted}>
              Google Calendar → Settings → [calendar name] → "Secret address in iCal format"
            </p>
          </div>
        ) : (
          <div className={styles.dayView}>
            <p className={styles.dateLabel}>{formatDate(new Date())}</p>
            {events.length === 0 ? (
              <p className={styles.muted}>No timed events today.</p>
            ) : (
              <ul className={styles.eventList}>
                {events.map(event => {
                  const current = isCurrentEvent(event)
                  const isTrade = traded.has(event.id)
                  return (
                    <li
                      key={event.id}
                      className={[
                        styles.eventRow,
                        current ? styles.current : '',
                        isTrade ? styles.tradedRow : '',
                      ].join(' ')}
                    >
                      <div className={styles.eventTime}>
                        <span>{event.start_time}</span>
                        <span className={styles.timeSep}>–</span>
                        <span>{event.end_time}</span>
                      </div>
                      <div className={styles.eventBody}>
                        <span className={styles.eventTitle}>{event.title}</span>
                        {current && !isTrade && (
                          <button className={styles.tradeBtn} onClick={() => handleTrade(event)}>
                            Trade for project work
                          </button>
                        )}
                        {isTrade && <span className={styles.tradedBadge}>traded</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
