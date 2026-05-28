import { useState, useEffect } from 'react'
import styles from './Today.module.css'

interface WorkoutLog {
  id: number
  exercise_name?: string
  reps: number
  weight: string
}

interface NutritionEntry {
  id: number
  ingredient_name?: string
  amount: number
  weight_unit?: string
}

interface TodayData {
  session: { id: number; workout: number; notes: string } | null
  logs: WorkoutLog[]
  nutrition: NutritionEntry[]
}

export default function Today() {
  const [data, setData] = useState<TodayData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/today')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className={styles.empty}>Loading…</p>
  if (!data) return <p className={styles.empty}>Could not load data.</p>

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Workout</span>
        {!data.session ? (
          <p className={styles.restDay}>No workout logged today.</p>
        ) : data.logs.length === 0 ? (
          <p className={styles.restDay}>Session started — no sets logged yet.</p>
        ) : (
          data.logs.map(log => (
            <div key={log.id} className={styles.logRow}>
              <span className={styles.logExercise}>{log.exercise_name ?? `Exercise #${log.id}`}</span>
              <span className={styles.logDetail}>
                {log.reps} reps{log.weight && log.weight !== '0.000' ? ` × ${parseFloat(log.weight)}kg` : ''}
              </span>
            </div>
          ))
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Nutrition</span>
        {data.nutrition.length === 0 ? (
          <p className={styles.restDay}>No meals logged today.</p>
        ) : (
          data.nutrition.map(entry => (
            <div key={entry.id} className={styles.mealRow}>
              <span className={styles.mealName}>{entry.ingredient_name ?? `Entry #${entry.id}`}</span>
              <span className={styles.mealCals}>{entry.amount}{entry.weight_unit ?? 'g'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
