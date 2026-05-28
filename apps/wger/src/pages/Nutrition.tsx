import { useState, useEffect } from 'react'
import styles from './Nutrition.module.css'

interface Plan {
  id: number
  description: string
}

interface DiaryEntry {
  id: number
  ingredient_name?: string
  amount: number
  weight_unit?: string
}

interface NutritionData {
  plans: Plan[]
  diary_today: DiaryEntry[]
}

export default function Nutrition() {
  const [data, setData] = useState<NutritionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/nutrition')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className={styles.empty}>Loading…</p>
  if (!data) return <p className={styles.empty}>Could not load data.</p>

  return (
    <div className={styles.root}>
      {data.plans.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Nutrition Plans</span>
          {data.plans.map(p => (
            <div key={p.id} className={styles.plan}>{p.description || `Plan #${p.id}`}</div>
          ))}
        </div>
      )}

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Today's Diary</span>
        {data.diary_today.length === 0 ? (
          <p className={styles.muted}>No entries logged today.</p>
        ) : (
          data.diary_today.map(e => (
            <div key={e.id} className={styles.diaryRow}>
              <span className={styles.diaryName}>{e.ingredient_name ?? `Entry #${e.id}`}</span>
              <span className={styles.diaryAmount}>{e.amount}{e.weight_unit ?? 'g'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
