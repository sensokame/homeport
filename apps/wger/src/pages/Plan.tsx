import { useState, useEffect } from 'react'
import styles from './Plan.module.css'

interface Day {
  id: number
  name: string
  day_names: string[]
  training: string
}

interface Routine {
  id: number
  name: string
  description?: string
}

interface PlanData {
  routines: Routine[]
  days: Day[]
}

export default function Plan() {
  const [data, setData] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/plan')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className={styles.empty}>Loading…</p>
  if (!data || data.routines.length === 0) {
    return <p className={styles.empty}>No routines yet — create one in wger to get started.</p>
  }

  return (
    <div className={styles.root}>
      {data.routines.map(r => {
        const days = data.days.filter(d => d.training === String(r.id) || (data.days.length > 0))
        return (
          <div key={r.id} className={styles.routine}>
            <span className={styles.routineName}>{r.name}</span>
            {r.description && <span className={styles.routineDesc}>{r.description}</span>}
            {data.days.length > 0 && (
              <div className={styles.dayList}>
                {data.days.map(d => (
                  <div key={d.id} className={styles.day}>
                    <span className={styles.dayName}>{d.name || `Day ${d.id}`}</span>
                    <span className={styles.dayTraining}>{d.day_names.join(', ') || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
