import { useEffect, useState } from 'react'
import type { WidgetProps } from '@homeport/ui'
import styles from './FitnessWidget.module.css'

interface Metric { label: string; value: string | number }
interface WidgetData { status: string; summary: string; metrics: Metric[] }
interface Exercise { id: number; name: string; logged: boolean; set_count: number }
interface TodayExercises { scheduled: boolean; exercises: Exercise[] }

export function FitnessWidget({ satelliteUrl, onStatusChange, onFocusRequest, isFocused }: WidgetProps) {
  const [data, setData] = useState<WidgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exercises, setExercises] = useState<TodayExercises | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [formReps, setFormReps] = useState('10')
  const [formWeight, setFormWeight] = useState('')
  const [formUnit, setFormUnit] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`${satelliteUrl}/widget`)
      .then(r => r.json())
      .then((d: WidgetData) => {
        setData(d)
        onStatusChange?.(d.status === 'ok' ? 'ok' : d.status === 'error' ? 'error' : 'warn')
      })
      .catch(() => onStatusChange?.('error'))
      .finally(() => setLoading(false))
  }, [satelliteUrl])

  useEffect(() => {
    if (!isFocused) return
    fetch(`${satelliteUrl}/api/today-exercises`)
      .then(r => r.json())
      .then(setExercises)
      .catch(() => setExercises({ scheduled: false, exercises: [] }))
  }, [isFocused, satelliteUrl])

  async function handleLog(exerciseId: number) {
    setSubmitting(true)
    try {
      const sessionRes = await fetch(`${satelliteUrl}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const { session } = await sessionRes.json()
      await fetch(`${satelliteUrl}/api/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_id: exerciseId,
          workout_id: session.workout,
          repetitions: parseInt(formReps) || 1,
          weight: parseFloat(formWeight) || 0,
          weight_unit: formUnit,
        }),
      })
      setExercises(prev => prev ? {
        ...prev,
        exercises: prev.exercises.map(e =>
          e.id === exerciseId ? { ...e, logged: true, set_count: e.set_count + 1 } : e
        ),
      } : prev)
      setActiveId(null)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>
  if (!data) return <div className={styles.panel}><p className={styles.empty}>Unavailable</p></div>

  if (isFocused) {
    return (
      <div className={styles.focusedPanel}>
        <div className={styles.focusedBlock}>
          <span className={styles.focusedMeta}>today's workout</span>
          {!exercises ? (
            <p className={styles.empty}>Loading exercises…</p>
          ) : !exercises.scheduled || exercises.exercises.length === 0 ? (
            <p className={styles.empty}>No exercises scheduled today</p>
          ) : (
            <div className={styles.exerciseList}>
              {exercises.exercises.map(ex => (
                <div key={ex.id} className={styles.exerciseBlock}>
                  <div className={styles.exerciseRow}>
                    <div className={styles.exerciseInfo}>
                      <span className={ex.logged ? styles.exNameDone : styles.exName}>{ex.name}</span>
                      {ex.set_count > 0 && (
                        <span className={styles.setCount}>{ex.set_count} set{ex.set_count !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <button
                      className={ex.logged ? styles.logBtnDone : styles.logBtn}
                      onClick={() => setActiveId(activeId === ex.id ? null : ex.id)}
                    >
                      {activeId === ex.id ? '×' : ex.logged ? '+ set' : 'Log →'}
                    </button>
                  </div>
                  {activeId === ex.id && (
                    <div className={styles.logForm}>
                      <input
                        className={styles.logInput}
                        type="number"
                        placeholder="Reps"
                        value={formReps}
                        onChange={e => setFormReps(e.target.value)}
                        min={1}
                      />
                      <input
                        className={styles.logInput}
                        type="number"
                        placeholder="Weight"
                        value={formWeight}
                        onChange={e => setFormWeight(e.target.value)}
                        min={0}
                        step={0.5}
                      />
                      <button
                        className={styles.unitToggle}
                        onClick={() => setFormUnit(u => u === 1 ? 2 : 1)}
                        type="button"
                      >
                        {formUnit === 1 ? 'kg' : 'lbs'}
                      </button>
                      <button
                        className={styles.submitBtn}
                        onClick={() => handleLog(ex.id)}
                        disabled={submitting}
                      >
                        {submitting ? '…' : 'Done'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.summary}>{data.summary}</p>
        {onFocusRequest && (
          <button className={styles.focusBtn} onClick={onFocusRequest}>focus →</button>
        )}
      </div>
      <div className={styles.metricGrid}>
        {data.metrics.map(m => (
          <div key={m.label} className={styles.metricRow}>
            <span className={styles.metricLabel}>{m.label}</span>
            <span className={styles.metricValue}>{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
