import { useEffect, useState, useCallback } from 'react'
import {
  fetchMusicOverview, fetchMusicCurriculum, setMusicCurriculumDone,
  startMusicSession, endMusicSession,
} from '../api'
import type { MusicOverview, MusicCurriculumItem, OpenMusicSession, MusicSession } from '../types'
import styles from './Music.module.css'

function subjectLabel(subject: string): string {
  return subject.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function OverviewSection({
  overview, openSession, lastSession, onStart, onEnd,
}: {
  overview: MusicOverview
  openSession: OpenMusicSession | null
  lastSession: MusicSession | null
  onStart: () => void
  onEnd: () => void
}) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!openSession) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [openSession])

  void tick // re-render trigger for the live elapsed-time display

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Today</h2>
      {overview.today ? (
        <p className={styles.summary}>
          {overview.today.day} · {overview.today.focus}
          {overview.current_streak_days > 0 && ` · ${overview.current_streak_days}d streak`}
        </p>
      ) : (
        <p className={styles.muted}>No schedule found</p>
      )}

      {openSession ? (
        <div className={styles.sessionRow}>
          <span className={styles.elapsed}>
            {subjectLabel(openSession.subject)} · {formatElapsed(Date.now() - new Date(openSession.started_at).getTime())} elapsed
          </span>
          <button className={styles.endBtn} onClick={onEnd}>End session</button>
        </div>
      ) : (
        <div className={styles.sessionRow}>
          {lastSession && (
            <span className={styles.muted}>
              Last: {subjectLabel(lastSession.subject)} · {formatElapsed(lastSession.duration_seconds * 1000)}
            </span>
          )}
          <button className={styles.startBtn} onClick={onStart}>
            Start {overview.today ? subjectLabel(overview.today.subject) : ''} session →
          </button>
        </div>
      )}
    </section>
  )
}

function CurriculumSection({ curriculum, onToggle }: { curriculum: MusicCurriculumItem[]; onToggle: (item: MusicCurriculumItem) => void }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Theory Curriculum</h2>
      <div className={styles.curriculumList}>
        {curriculum.map(item => (
          <label key={item.index} className={styles.curriculumRow}>
            <input type="checkbox" checked={item.done} onChange={() => onToggle(item)} />
            <span className={item.done ? styles.curriculumTextDone : styles.curriculumText}>{item.text}</span>
          </label>
        ))}
        {curriculum.length === 0 && <p className={styles.muted}>No curriculum found</p>}
      </div>
    </section>
  )
}

function ProgressSection({ overview }: { overview: MusicOverview }) {
  const groups: Array<[string, MusicOverview['progress']['ear_training']]> = [
    ['Ear Training', overview.progress.ear_training],
    ['Scales', overview.progress.scales],
    ['Sight Reading', overview.progress.sight_reading],
  ]
  if (!groups.some(([, items]) => Object.keys(items).length > 0)) return null

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Progress</h2>
      {groups.map(([label, items]) => (
        Object.keys(items).length > 0 && (
          <div key={label} className={styles.progressGroup}>
            <span className={styles.progressGroupLabel}>{label}</span>
            {Object.entries(items).map(([slug, item]) => (
              <div key={slug} className={styles.progressRow}>
                <span>{item.label}</span>
                <span className={styles.progressBadge}>{item.status}</span>
              </div>
            ))}
          </div>
        )
      ))}
    </section>
  )
}

export default function Music() {
  const [overview, setOverview] = useState<MusicOverview | null>(null)
  const [curriculum, setCurriculum] = useState<MusicCurriculumItem[]>([])
  const [openSession, setOpenSession] = useState<OpenMusicSession | null>(null)
  const [lastSession, setLastSession] = useState<MusicSession | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(() => {
    fetchMusicOverview().then(o => {
      setOverview(o)
      setOpenSession(o.open_session)
      setLastSession(o.last_session)
    }).finally(() => setLoading(false))
    fetchMusicCurriculum().then(setCurriculum)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleToggle(item: MusicCurriculumItem) {
    const updated = await setMusicCurriculumDone(item.index, !item.done)
    setCurriculum(updated)
    fetchMusicOverview().then(setOverview)
  }

  async function handleStart() {
    const subject = overview?.today?.subject ?? 'open'
    setOpenSession(await startMusicSession(subject))
  }

  async function handleEnd() {
    const session = await endMusicSession()
    setLastSession(session)
    setOpenSession(null)
    fetchAll()
  }

  if (loading || !overview) return <p className={styles.muted}>Loading…</p>

  return (
    <div>
      <OverviewSection
        overview={overview}
        openSession={openSession}
        lastSession={lastSession}
        onStart={handleStart}
        onEnd={handleEnd}
      />
      <CurriculumSection curriculum={curriculum} onToggle={handleToggle} />
      <ProgressSection overview={overview} />
    </div>
  )
}
