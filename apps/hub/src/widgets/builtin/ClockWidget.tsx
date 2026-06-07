import { useState, useEffect } from 'react'
import type { WidgetProps } from '@homeport/ui'
import styles from './ClockWidget.module.css'

function fmt(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export function ClockWidget({ onStatusChange }: WidgetProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    onStatusChange?.('ok')
  }, [onStatusChange])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className={styles.root}>
      <div className={styles.time}>{fmt(now)}</div>
      <div className={styles.date}>{fmtDate(now)}</div>
    </div>
  )
}
