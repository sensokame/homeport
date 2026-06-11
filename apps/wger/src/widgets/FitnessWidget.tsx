import { useEffect, useRef, useState } from 'react'
import type { WidgetProps } from '@homeport/ui'
import { SwipeableCard } from '@homeport/ui'
import styles from './FitnessWidget.module.css'

interface Metric { label: string; value: string | number }
interface WidgetData { status: string; summary: string; metrics: Metric[] }
interface Exercise { id: number; name: string }
interface DayInfo { id: number; name: string; exercises: Exercise[] }
interface WeightEntry { id: number; date: string; weight: string }
interface PR { exercise_id: number; name: string; best_weight: number; best_reps: number; date: string | null; type: 'weighted' | 'bodyweight' }
interface LoggedExercise { exercise_id: number; name: string; sets: number }
interface DiaryEntry { id: number; ingredient_id: number; ingredient_name: string; amount: string; energy: number; protein: number; carbohydrates: number; fat: number }
interface Macros { energy: number; protein: number; carbohydrates: number; fat: number }
interface Goals { energy: number | null; protein: number | null; carbohydrates: number | null; fat: number | null }
interface ExInfo { description: string; muscles: string[]; equipment: string[] }

export function FitnessWidget({ satelliteUrl, onStatusChange, onFocusRequest, isFocused }: WidgetProps) {
  // card
  const [data, setData] = useState<WidgetData | null>(null)
  const [cardLoading, setCardLoading] = useState(true)

  // focus — shared
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading')
  const [nextLetter, setNextLetter] = useState('A')
  const [trainingDayToday, setTrainingDayToday] = useState(false)
  const [allDays, setAllDays] = useState<DayInfo[]>([])
  const [selectedDay, setSelectedDay] = useState<DayInfo | null>(null)
  const [sessionWorkoutId, setSessionWorkoutId] = useState<number | null>(null)
  const [setCounts, setSetCounts] = useState<Record<number, number>>({})
  const sessionDayNameRef = useRef<string | null>(null)

  // weight
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([])
  const [records, setRecords] = useState<PR[]>([])
  const [showLogWeight, setShowLogWeight] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [loggingWeight, setLoggingWeight] = useState(false)

  // logged
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([])

  // meals
  const [diary, setDiary] = useState<DiaryEntry[]>([])
  const [planId, setPlanId] = useState<number | null>(null)
  const [totals, setTotals] = useState<Macros | null>(null)
  const [goals, setGoals] = useState<Goals | null>(null)
  const [mealQuery, setMealQuery] = useState('')
  const [mealResults, setMealResults] = useState<Exercise[]>([])
  const [mealSearching, setMealSearching] = useState(false)
  const [selectedIng, setSelectedIng] = useState<Exercise | null>(null)
  const [mealAmount, setMealAmount] = useState('')
  const [loggingMeal, setLoggingMeal] = useState(false)
  const [editingDiaryId, setEditingDiaryId] = useState<number | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [showGoalEdit, setShowGoalEdit] = useState(false)
  const [goalInputs, setGoalInputs] = useState({ energy: '', protein: '', carbohydrates: '', fat: '' })
  const [savingGoals, setSavingGoals] = useState(false)

  // workout
  const [showDayPicker, setShowDayPicker] = useState(false)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [replacements, setReplacements] = useState<Map<number, Exercise>>(new Map())
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null)
  const [explainId, setExplainId] = useState<number | null>(null)
  const [explainCache, setExplainCache] = useState<Record<number, ExInfo>>({})
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Exercise[]>([])
  const [searching, setSearching] = useState(false)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [formReps, setFormReps] = useState('10')
  const [formWeight, setFormWeight] = useState('')
  const [formUnit, setFormUnit] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)

  // Load card data on mount: weight, schedule, meals, logged summary
  useEffect(() => {
    Promise.all([
      fetch(`${satelliteUrl}/widget`).then(r => r.json()),
      fetch(`${satelliteUrl}/api/next-session`).then(r => r.json()),
      fetch(`${satelliteUrl}/api/today`).then(r => r.json()),
      fetch(`${satelliteUrl}/api/weight`).then(r => r.json()),
      fetch(`${satelliteUrl}/api/today-meals`).then(r => r.json()),
    ]).then(([wd, ns, today, wt, meals]) => {
      setData(wd)
      onStatusChange?.(wd.status === 'ok' ? 'ok' : wd.status === 'error' ? 'error' : 'warn')
      setNextLetter(ns.next)
      setTrainingDayToday(ns.training_day_today)
      const counts: Record<number, number> = {}
      for (const log of (today.logs ?? [])) counts[log.exercise] = (counts[log.exercise] ?? 0) + 1
      setSetCounts(counts)
      if (today.session) {
        setSessionWorkoutId(today.session.workout)
        sessionDayNameRef.current = (today.session.notes ?? '').trim()
      }
      setLoggedExercises(today.logged ?? [])
      setWeightEntries(wt.entries ?? [])
      setDiary(meals.entries ?? [])
      setPlanId(meals.plan_id ?? null)
      setTotals(meals.totals ?? null)
      setGoals(meals.goals ?? null)
      if (meals.goals) {
        setGoalInputs({
          energy: meals.goals.energy?.toString() ?? '',
          protein: meals.goals.protein?.toString() ?? '',
          carbohydrates: meals.goals.carbohydrates?.toString() ?? '',
          fat: meals.goals.fat?.toString() ?? '',
        })
      }
    }).catch(() => onStatusChange?.('error'))
    .finally(() => setCardLoading(false))
  }, [satelliteUrl])

  // Load focus-only data: all days + personal records
  useEffect(() => {
    if (!isFocused) return
    setPhase('loading')
    setShowDayPicker(false)
    setActiveId(null)
    setReplaceTarget(null)
    setExplainId(null)

    Promise.all([
      fetch(`${satelliteUrl}/api/all-days`).then(r => r.json()),
      fetch(`${satelliteUrl}/api/records`).then(r => r.json()),
    ]).then(([ad, rec]) => {
      const days: DayInfo[] = ad.days ?? []
      setAllDays(days)
      setRecords(rec.records ?? [])
      const dayName = sessionDayNameRef.current
      setSelectedDay(days.find(d => d.name === (dayName ?? '')) ?? days[0] ?? null)
      setPhase('ready')
    }).catch(() => setPhase('ready'))
  }, [isFocused, satelliteUrl])

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try { setSearchResults(await fetch(`${satelliteUrl}/api/exercises?q=${encodeURIComponent(searchQuery)}`).then(r => r.json())) }
      finally { setSearching(false) }
    }, 350)
  }, [searchQuery, satelliteUrl])

  const mealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!mealQuery.trim()) { setMealResults([]); return }
    if (mealTimer.current) clearTimeout(mealTimer.current)
    mealTimer.current = setTimeout(async () => {
      setMealSearching(true)
      try { setMealResults(await fetch(`${satelliteUrl}/api/ingredients?q=${encodeURIComponent(mealQuery)}`).then(r => r.json())) }
      finally { setMealSearching(false) }
    }, 350)
  }, [mealQuery, satelliteUrl])

  async function startSession(dayName: string): Promise<number> {
    const { session } = await fetch(`${satelliteUrl}/api/session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day_name: dayName }),
    }).then(r => r.json())
    setSessionWorkoutId(session.workout)
    return session.workout
  }

  async function handleVenuePick(venue: 'Gym' | 'Home') {
    const dayName = `${nextLetter} - ${venue}`
    await startSession(dayName)
    setSelectedDay(allDays.find(d => d.name === dayName) ?? allDays[0] ?? null)
  }

  async function handleLog(exerciseId: number) {
    setSubmitting(true)
    try {
      const workoutId = sessionWorkoutId ?? await startSession('')
      await fetch(`${satelliteUrl}/api/log`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_id: exerciseId, workout_id: workoutId, repetitions: parseInt(formReps) || 1, weight: parseFloat(formWeight) || 0, weight_unit: formUnit }),
      })
      setSetCounts(prev => ({ ...prev, [exerciseId]: (prev[exerciseId] ?? 0) + 1 }))
      setLoggedExercises(prev => {
        const existing = prev.find(e => e.exercise_id === exerciseId)
        if (existing) return prev.map(e => e.exercise_id === exerciseId ? { ...e, sets: e.sets + 1 } : e)
        return [...prev, { exercise_id: exerciseId, name: selectedDay?.exercises.find(e => e.id === exerciseId)?.name ?? `Exercise ${exerciseId}`, sets: 1 }]
      })
      setActiveId(null)
    } finally { setSubmitting(false) }
  }

  function handleReplace(originalId: number, replacement: Exercise) {
    setReplacements(prev => new Map(prev).set(originalId, replacement))
    setReplaceTarget(null); setSearchQuery(''); setSearchResults([])
  }

  function toggleSkip(id: number) {
    setSkipped(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
    setActiveId(null); setReplaceTarget(null); setExplainId(null)
  }

  async function handleExplain(id: number) {
    if (explainId === id) { setExplainId(null); return }
    setExplainId(id)
    if (explainCache[id]) return
    setLoadingInfo(true)
    try { setExplainCache(prev => ({ ...prev, [id]: null as unknown as ExInfo }))
      const info = await fetch(`${satelliteUrl}/api/exercise/${id}/info`).then(r => r.json())
      setExplainCache(prev => ({ ...prev, [id]: info }))
    } finally { setLoadingInfo(false) }
  }

  async function handleLogWeight() {
    if (!weightInput) return
    setLoggingWeight(true)
    try {
      const entry: WeightEntry = await fetch(`${satelliteUrl}/api/weight`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight: parseFloat(weightInput) }),
      }).then(r => r.json())
      setWeightEntries(prev => [entry, ...prev].slice(0, 7))
      setWeightInput(''); setShowLogWeight(false)
    } finally { setLoggingWeight(false) }
  }

  async function handleDeleteDiary(id: number) {
    await fetch(`${satelliteUrl}/api/nutrition-diary/${id}`, { method: 'DELETE' })
    setDiary(prev => {
      const updated = prev.filter(e => e.id !== id)
      const t = updated.reduce((acc, e) => ({
        energy: acc.energy + e.energy, protein: acc.protein + e.protein,
        carbohydrates: acc.carbohydrates + e.carbohydrates, fat: acc.fat + e.fat,
      }), { energy: 0, protein: 0, carbohydrates: 0, fat: 0 })
      setTotals(t)
      return updated
    })
  }

  async function handleEditDiary(id: number) {
    if (!editAmount) return
    setSavingEdit(true)
    try {
      await fetch(`${satelliteUrl}/api/nutrition-diary/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(editAmount) }),
      })
      setDiary(prev => {
        const updated = prev.map(e => e.id !== id ? e : { ...e, amount: editAmount })
        const t = updated.reduce((acc, e) => ({
          energy: acc.energy + e.energy, protein: acc.protein + e.protein,
          carbohydrates: acc.carbohydrates + e.carbohydrates, fat: acc.fat + e.fat,
        }), { energy: 0, protein: 0, carbohydrates: 0, fat: 0 })
        setTotals(t)
        return updated
      })
      setEditingDiaryId(null)
    } finally { setSavingEdit(false) }
  }

  async function handleSaveGoals() {
    if (!planId) return
    setSavingGoals(true)
    try {
      const payload = {
        goal_energy: goalInputs.energy ? parseFloat(goalInputs.energy) : null,
        goal_protein: goalInputs.protein ? parseFloat(goalInputs.protein) : null,
        goal_carbohydrates: goalInputs.carbohydrates ? parseFloat(goalInputs.carbohydrates) : null,
        goal_fat: goalInputs.fat ? parseFloat(goalInputs.fat) : null,
      }
      await fetch(`${satelliteUrl}/api/nutrition-plan/${planId}/goals`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setGoals({ energy: payload.goal_energy, protein: payload.goal_protein, carbohydrates: payload.goal_carbohydrates, fat: payload.goal_fat })
      setShowGoalEdit(false)
    } finally { setSavingGoals(false) }
  }

  async function handleLogMeal() {
    if (!selectedIng || !mealAmount || !planId) return
    setLoggingMeal(true)
    try {
      await fetch(`${satelliteUrl}/api/nutrition-diary`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, ingredient_id: selectedIng.id, amount: parseFloat(mealAmount) }),
      })
      setDiary(prev => [...prev, { id: Date.now(), ingredient_id: selectedIng.id, ingredient_name: selectedIng.name, amount: mealAmount, energy: 0, protein: 0, carbohydrates: 0, fat: 0 }])
      setSelectedIng(null); setMealAmount('')
    } finally { setLoggingMeal(false) }
  }

  // ── Focused view ─────────────────────────────────────────────────────────────

  if (isFocused) {
    if (phase === 'loading') {
      return <div className={styles.focusedPanel}><div className={styles.focusedBlock}><p className={styles.empty}>Loading…</p></div></div>
    }

    // ── Workout ───────────────────────────────────────────────────────────────
    const workoutPanel = (
      <div className={styles.panelContent}>
        {!sessionWorkoutId ? (
          <>
            <span className={styles.panelTitle}>session {nextLetter}</span>
            <p className={styles.venuePrompt}>Gym or home today?</p>
            <div className={styles.venuePicker}>
              <button className={styles.venueBtn} onClick={() => handleVenuePick('Gym')}>Gym</button>
              <button className={styles.venueBtn} onClick={() => handleVenuePick('Home')}>Home</button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.dayHeader}>
              <span className={styles.panelTitle}>{selectedDay?.name ?? 'workout'}</span>
              <button className={styles.switchDayBtn} onClick={() => setShowDayPicker(v => !v)}>
                {showDayPicker ? 'cancel' : 'switch day'}
              </button>
            </div>
            {showDayPicker && (
              <div className={styles.dayPicker}>
                {allDays.map(d => (
                  <button key={d.id} className={d.id === selectedDay?.id ? styles.dayOptionActive : styles.dayOption}
                    onClick={() => { setSelectedDay(d); setShowDayPicker(false) }}>
                    {d.name}
                  </button>
                ))}
              </div>
            )}
            <div className={styles.exerciseList}>
              {(selectedDay?.exercises ?? []).map(ex => {
                const activeEx = replacements.get(ex.id) ?? ex
                const isSkipped = skipped.has(ex.id)
                const count = setCounts[activeEx.id] ?? 0
                const isReplaced = replacements.has(ex.id)
                const exInfo = explainCache[activeEx.id]

                return (
                  <div key={ex.id} className={isSkipped ? styles.exerciseBlockSkipped : styles.exerciseBlock}>
                    <div className={styles.exerciseRow}>
                      <div className={styles.exerciseInfo}>
                        <span className={isSkipped ? styles.exNameSkipped : count > 0 ? styles.exNameDone : styles.exName}>
                          {activeEx.name}
                        </span>
                        <div className={styles.exTags}>
                          {isReplaced && <span className={styles.replacedTag}>replaced</span>}
                          {count > 0 && <span className={styles.setCount}>{count} set{count !== 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                      {!isSkipped && (
                        <button className={count > 0 ? styles.logBtnDone : styles.logBtn}
                          onClick={() => { setReplaceTarget(null); setExplainId(null); setActiveId(activeId === ex.id ? null : ex.id) }}>
                          {activeId === ex.id ? '×' : count > 0 ? '+ set' : 'Log →'}
                        </button>
                      )}
                    </div>
                    <div className={styles.exerciseSecondary}>
                      <button className={styles.actionBtn} onClick={() => {
                        setActiveId(null); setExplainId(null)
                        setReplaceTarget(replaceTarget === ex.id ? null : ex.id)
                        setSearchQuery(''); setSearchResults([])
                      }}>{replaceTarget === ex.id ? 'cancel' : isReplaced ? 'replace again' : 'replace'}</button>
                      <span className={styles.actionDivider}>·</span>
                      <button className={styles.actionBtn} onClick={() => toggleSkip(ex.id)}>
                        {isSkipped ? 'undo skip' : 'skip'}
                      </button>
                      <span className={styles.actionDivider}>·</span>
                      <button className={styles.actionBtn} onClick={() => { setActiveId(null); setReplaceTarget(null); handleExplain(activeEx.id) }}>
                        {explainId === activeEx.id ? 'close' : 'explain'}
                      </button>
                    </div>
                    {activeId === ex.id && !isSkipped && (
                      <div className={styles.logForm}>
                        <input className={styles.logInput} type="number" placeholder="Reps" value={formReps}
                          onChange={e => setFormReps(e.target.value)} min={1} />
                        <input className={styles.logInput} type="number" placeholder="Weight" value={formWeight}
                          onChange={e => setFormWeight(e.target.value)} min={0} step={0.5} />
                        <button className={styles.unitToggle} onClick={() => setFormUnit(u => u === 1 ? 2 : 1)} type="button">
                          {formUnit === 1 ? 'kg' : 'lbs'}
                        </button>
                        <button className={styles.submitBtn} onClick={() => handleLog(activeEx.id)} disabled={submitting}>
                          {submitting ? '…' : 'Done'}
                        </button>
                      </div>
                    )}
                    {replaceTarget === ex.id && (
                      <div className={styles.replacePanel}>
                        <input className={styles.searchInput} type="text" placeholder="Search exercise…"
                          value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
                        {searching && <p className={styles.searchHint}>Searching…</p>}
                        {!searching && searchResults.length > 0 && (
                          <div className={styles.searchResults}>
                            {searchResults.slice(0, 6).map(r => (
                              <button key={r.id} className={styles.searchResult} onClick={() => handleReplace(ex.id, r)}>{r.name}</button>
                            ))}
                          </div>
                        )}
                        {!searching && searchQuery.trim() && searchResults.length === 0 && <p className={styles.searchHint}>No results</p>}
                      </div>
                    )}
                    {explainId === activeEx.id && (
                      <div className={styles.explainPanel}>
                        {!exInfo && loadingInfo
                          ? <p className={styles.searchHint}>Loading…</p>
                          : exInfo ? (
                            <>
                              {exInfo.description
                                ? <div className={styles.explainDescription} dangerouslySetInnerHTML={{ __html: exInfo.description }} />
                                : null}
                              {exInfo.muscles.length > 0 && (
                                <p className={styles.explainMeta}><strong>Muscles:</strong> {exInfo.muscles.join(', ')}</p>
                              )}
                              {exInfo.equipment.length > 0 && (
                                <p className={styles.explainMeta}><strong>Equipment:</strong> {exInfo.equipment.join(', ')}</p>
                              )}
                              {!exInfo.description && exInfo.muscles.length === 0 && (
                                <p className={styles.searchHint}>No details available</p>
                              )}
                            </>
                          ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    )

    // ── PRs ───────────────────────────────────────────────────────────────────
    const prsPanel = (
      <div className={styles.panelContent}>
        <span className={styles.panelTitle}>personal records</span>
        {records.length > 0 ? (
          <div className={styles.recordsList}>
            {records.map(r => (
              <div key={r.exercise_id} className={styles.recordRow}>
                <span className={styles.recordName}>{r.name}</span>
                <span className={styles.recordValue}>
                  {r.type === 'weighted' ? `${r.best_weight} kg × ${r.best_reps}` : `${r.best_reps} reps`}
                </span>
              </div>
            ))}
          </div>
        ) : <p className={styles.empty}>No records yet</p>}
      </div>
    )

    return (
      <div className={styles.swipeableContainer}>
        <SwipeableCard home={workoutPanel} pages={[prsPanel]} />
      </div>
    )
  }

  // ── Normal card (SwipeableCard: overview / logged / meals) ────────────────────

  if (cardLoading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>

  const weightDelta = weightEntries.length > 1
    ? parseFloat(weightEntries[0].weight) - parseFloat(weightEntries[1].weight)
    : null

  // ── Overview panel ────────────────────────────────────────────────────────
  const overviewPanel = (
    <div className={styles.panelContent}>
      <section className={styles.overviewSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>body weight</span>
          <button className={styles.actionBtn} onClick={() => setShowLogWeight(v => !v)}>
            {showLogWeight ? 'cancel' : 'log'}
          </button>
        </div>
        {weightEntries.length > 0 ? (
          <>
            <div className={styles.weightMain}>
              <span className={styles.weightValue}>{weightEntries[0].weight} kg</span>
              {weightDelta !== null && weightDelta !== 0 && (
                <span className={weightDelta > 0 ? styles.weightUp : styles.weightDown}>
                  {weightDelta > 0 ? '▲' : '▼'} {Math.abs(weightDelta).toFixed(1)}
                </span>
              )}
            </div>
            <div className={styles.weightHistory}>
              {weightEntries.slice(0, 4).map(e => (
                <span key={e.id} className={styles.weightHistoryItem}>{e.weight} · {e.date.slice(5)}</span>
              ))}
            </div>
          </>
        ) : <p className={styles.empty}>No entries yet</p>}
        {showLogWeight && (
          <div className={styles.logForm}>
            <input className={styles.logInput} type="number" placeholder="kg" value={weightInput}
              onChange={e => setWeightInput(e.target.value)} step={0.1} autoFocus />
            <button className={styles.submitBtn} onClick={handleLogWeight} disabled={loggingWeight || !weightInput}>
              {loggingWeight ? '…' : 'Save'}
            </button>
          </div>
        )}
      </section>

      <section className={styles.overviewSection}>
        <span className={styles.sectionLabel}>schedule</span>
        <p className={styles.scheduleInfo}>
          {sessionWorkoutId
            ? `${sessionDayNameRef.current ?? 'Session'} ✓`
            : trainingDayToday
              ? `Session ${nextLetter} — training day`
              : `Rest day · Session ${nextLetter} up next`}
        </p>
        {onFocusRequest && (
          <button className={styles.focusBtn} onClick={onFocusRequest}>workout →</button>
        )}
      </section>
    </div>
  )

  // ── Logged panel ──────────────────────────────────────────────────────────
  const loggedPanel = (
    <div className={styles.panelContent}>
      <span className={styles.panelTitle}>logged today</span>
      {loggedExercises.length > 0 ? (
        <div className={styles.recordsList}>
          {loggedExercises.map(ex => (
            <div key={ex.exercise_id} className={styles.recordRow}>
              <span className={styles.recordName}>{ex.name}</span>
              <span className={styles.recordValue}>{ex.sets} set{ex.sets !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      ) : <p className={styles.empty}>No session today</p>}
    </div>
  )

  // ── Meals panel ───────────────────────────────────────────────────────────
  const mealsPanel = (
    <div className={styles.panelContent}>
      <div className={styles.mealsPanelHeader}>
        <span className={styles.panelTitle}>meals</span>
        <button className={styles.actionBtn} onClick={() => {
          setShowGoalEdit(v => !v)
          if (!showGoalEdit && goals) setGoalInputs({
            energy: goals.energy?.toString() ?? '',
            protein: goals.protein?.toString() ?? '',
            carbohydrates: goals.carbohydrates?.toString() ?? '',
            fat: goals.fat?.toString() ?? '',
          })
        }}>
          {showGoalEdit ? 'cancel' : 'set goals'}
        </button>
      </div>

      {totals && (
        <div className={styles.macroGrid}>
          {(['energy', 'protein', 'carbohydrates', 'fat'] as const).map(key => {
            const goal = goals?.[key]
            const val = totals[key]
            const label = key === 'carbohydrates' ? 'carbs' : key
            const unit = key === 'energy' ? 'kcal' : 'g'
            return (
              <div key={key} className={styles.macroCell}>
                <span className={styles.macroLabel}>{label}</span>
                <span className={styles.macroValue}>{Math.round(val)}<span className={styles.macroUnit}>{unit}</span></span>
                {goal != null && <span className={styles.macroGoal}>/ {Math.round(goal)}</span>}
              </div>
            )
          })}
        </div>
      )}

      {showGoalEdit && (
        <div className={styles.goalEditor}>
          <div className={styles.goalGrid}>
            {(['energy', 'protein', 'carbohydrates', 'fat'] as const).map(key => (
              <div key={key} className={styles.goalField}>
                <label className={styles.goalLabel}>{key === 'carbohydrates' ? 'carbs' : key}</label>
                <input className={styles.logInput} type="number" placeholder={key === 'energy' ? 'kcal' : 'g'}
                  value={goalInputs[key]}
                  onChange={e => setGoalInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  min={0} />
              </div>
            ))}
          </div>
          <button className={styles.submitBtn} onClick={handleSaveGoals} disabled={savingGoals}>
            {savingGoals ? '…' : 'Save goals'}
          </button>
        </div>
      )}

      {diary.length > 0 ? (
        <div className={styles.diaryList}>
          {diary.map(e => (
            <div key={e.id} className={styles.diaryEntry}>
              <div className={styles.diaryRow}>
                <span className={styles.diaryName}>{e.ingredient_name}</span>
                <div className={styles.diaryActions}>
                  {editingDiaryId === e.id ? (
                    <>
                      <input className={styles.diaryAmountInput} type="number" value={editAmount}
                        onChange={ev => setEditAmount(ev.target.value)} min={0} autoFocus />
                      <button className={styles.actionBtn} onClick={() => handleEditDiary(e.id)} disabled={savingEdit}>
                        {savingEdit ? '…' : '✓'}
                      </button>
                      <button className={styles.actionBtn} onClick={() => setEditingDiaryId(null)}>×</button>
                    </>
                  ) : (
                    <>
                      <button className={styles.diaryAmountBtn}
                        onClick={() => { setEditingDiaryId(e.id); setEditAmount(parseFloat(e.amount).toFixed(0)) }}>
                        {parseFloat(e.amount).toFixed(0)} g
                      </button>
                      <button className={styles.actionBtn} onClick={() => handleDeleteDiary(e.id)}>×</button>
                    </>
                  )}
                </div>
              </div>
              {e.energy > 0 && (
                <div className={styles.diaryMacros}>
                  <span>{Math.round(e.energy)} kcal</span>
                  <span>P {e.protein.toFixed(1)}g</span>
                  <span>C {e.carbohydrates.toFixed(1)}g</span>
                  <span>F {e.fat.toFixed(1)}g</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : <p className={styles.empty}>Nothing logged today</p>}

      {selectedIng ? (
        <div className={styles.mealForm}>
          <span className={styles.selectedIngName}>{selectedIng.name}</span>
          <div className={styles.logForm}>
            <input className={styles.logInput} type="number" placeholder="g / ml"
              value={mealAmount} onChange={e => setMealAmount(e.target.value)} min={0} autoFocus />
            <button className={styles.submitBtn} onClick={handleLogMeal} disabled={loggingMeal || !mealAmount}>
              {loggingMeal ? '…' : 'Log'}
            </button>
            <button className={styles.actionBtn} onClick={() => { setSelectedIng(null); setMealAmount('') }}>×</button>
          </div>
        </div>
      ) : (
        <div className={styles.replacePanel}>
          <input className={styles.searchInput} type="text" placeholder="Search food…"
            value={mealQuery} onChange={e => setMealQuery(e.target.value)} />
          {mealSearching && <p className={styles.searchHint}>Searching…</p>}
          {!mealSearching && mealResults.length > 0 && (
            <div className={styles.searchResults}>
              {mealResults.slice(0, 5).map(r => (
                <button key={r.id} className={styles.searchResult}
                  onClick={() => { setSelectedIng(r); setMealQuery(''); setMealResults([]) }}>
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className={styles.cardContainer}>
      <SwipeableCard home={overviewPanel} pages={[loggedPanel, mealsPanel]} />
    </div>
  )
}
