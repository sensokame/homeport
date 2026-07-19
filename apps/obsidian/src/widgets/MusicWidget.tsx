import { useEffect, useState, useCallback } from 'react'
import { SwipeableCard } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type { MusicOverview, MusicCurriculumItem, MusicSession, OpenMusicSession } from './types'
import styles from './MusicWidget.module.css'

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function subjectLabel(subject: string): string {
  return subject.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function HomePanel({ overview }: { overview: MusicOverview }) {
  return (
    <div className={styles.panel}>
      <span className={styles.pageTitle}>Music</span>
      <p className={styles.summary}>
        {overview.today ? `Today: ${overview.today.focus}` : 'No schedule found'}
        {overview.current_streak_days > 0 && ` · ${overview.current_streak_days}d streak`}
      </p>
      <div className={styles.metaRow}>Theory: {overview.curriculum_done}/{overview.curriculum_total}</div>
      {overview.last_session && (
        <p className={styles.lastSession}>
          Last: {subjectLabel(overview.last_session.subject)} · {formatElapsed(overview.last_session.duration_seconds * 1000)}
        </p>
      )}
    </div>
  )
}

function DetailPanel({
  overview, curriculum, satelliteUrl, onCurriculumChanged, onFocusStart,
}: {
  overview: MusicOverview
  curriculum: MusicCurriculumItem[]
  satelliteUrl: string
  onCurriculumChanged: () => void
  onFocusStart?: () => void
}) {
  async function toggle(item: MusicCurriculumItem) {
    await fetch(`${satelliteUrl}/api/music/curriculum/theory/${item.index}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !item.done }),
    })
    onCurriculumChanged()
  }

  const progressGroups: Array<[string, MusicOverview['progress']['ear_training']]> = [
    ['Ear Training', overview.progress.ear_training],
    ['Scales', overview.progress.scales],
    ['Sight Reading', overview.progress.sight_reading],
  ]
  const hasProgress = progressGroups.some(([, items]) => Object.keys(items).length > 0)

  return (
    <div className={styles.panel}>
      <span className={styles.pageTitle}>Theory Curriculum</span>
      <div className={styles.curriculumList}>
        {curriculum.map(item => (
          <label key={item.index} className={styles.curriculumRow}>
            <input type="checkbox" checked={item.done} onChange={() => toggle(item)} />
            <span className={item.done ? styles.curriculumTextDone : styles.curriculumText}>{item.text}</span>
          </label>
        ))}
        {curriculum.length === 0 && <p className={styles.empty}>No curriculum found</p>}
      </div>

      {hasProgress && (
        <div className={styles.progressSection}>
          <span className={styles.pageTitle}>Progress</span>
          {progressGroups.map(([label, items]) => (
            Object.keys(items).length > 0 && (
              <div key={label} className={styles.progressGroup}>
                <span className={styles.progressGroupLabel}>{label}</span>
                {Object.entries(items).map(([slug, item]) => (
                  <div key={slug} className={styles.progressRow}>
                    <span className={styles.progressItemLabel}>{item.label}</span>
                    <span className={styles.progressBadge}>{item.status}</span>
                  </div>
                ))}
              </div>
            )
          ))}
        </div>
      )}

      {onFocusStart && (
        <button className={styles.focusStartBtn} onClick={onFocusStart}>
          Start session →
        </button>
      )}
    </div>
  )
}

type FocusStage = 'idle' | 'active' | 'done'

export function MusicWidget({ satelliteUrl, onStatusChange, onFocusRequest, isFocused }: WidgetProps) {
  const [overview, setOverview] = useState<MusicOverview | null>(null)
  const [curriculum, setCurriculum] = useState<MusicCurriculumItem[]>([])
  const [loading, setLoading] = useState(true)

  const [focusStage, setFocusStage] = useState<FocusStage>('idle')
  const [openSession, setOpenSession] = useState<OpenMusicSession | null>(null)
  const [lastSession, setLastSession] = useState<MusicSession | null>(null)
  const [tick, setTick] = useState(0)

  const fetchCurriculum = useCallback(() => {
    fetch(`${satelliteUrl}/api/music/curriculum/theory`)
      .then(r => r.json())
      .then(setCurriculum)
  }, [satelliteUrl])

  const fetchData = useCallback(() => {
    fetch(`${satelliteUrl}/api/music/overview`)
      .then(r => r.json())
      .then((d: MusicOverview) => {
        setOverview(d)
        onStatusChange?.('ok')
      })
      .catch(() => onStatusChange?.('error'))
      .finally(() => setLoading(false))
    fetchCurriculum()
  }, [satelliteUrl, fetchCurriculum, onStatusChange])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!isFocused) {
      setFocusStage('idle')
      setOpenSession(null)
      setLastSession(null)
      return
    }
    fetch(`${satelliteUrl}/api/music/sessions`)
      .then(r => r.json())
      .then((d: { open_session: OpenMusicSession | null }) => {
        if (d.open_session) {
          setOpenSession(d.open_session)
          setFocusStage('active')
        }
      })
  }, [isFocused, satelliteUrl])

  useEffect(() => {
    if (focusStage !== 'active') return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [focusStage])

  async function handleStart() {
    const subject = overview?.today?.subject ?? 'open'
    const res = await fetch(`${satelliteUrl}/api/music/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject }),
    })
    if (res.ok) {
      setOpenSession(await res.json())
      setFocusStage('active')
    }
  }

  async function handleEnd() {
    const res = await fetch(`${satelliteUrl}/api/music/sessions/end`, { method: 'POST' })
    if (res.ok) {
      setLastSession(await res.json())
      setFocusStage('done')
      fetchData()
    }
  }

  if (loading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>
  if (!overview) return <div className={styles.panel}><p className={styles.empty}>Unavailable</p></div>

  if (isFocused) {
    if (focusStage === 'idle') {
      return (
        <div className={styles.focusedPanel}>
          <div className={styles.focusedBlock}>
            <span className={styles.focusedMeta}>music session</span>
            <h1 className={styles.focusedTitle}>{overview.today ? overview.today.focus : 'Practice'}</h1>
            <button className={styles.startBtn} onClick={handleStart}>Start →</button>
          </div>
        </div>
      )
    }

    if (focusStage === 'active' && openSession) {
      void tick
      const elapsed = Date.now() - new Date(openSession.started_at).getTime()
      return (
        <div className={styles.focusedPanel}>
          <div className={styles.focusedBlock}>
            <span className={styles.focusedMeta}>{subjectLabel(openSession.subject)}</span>
            <h1 className={styles.focusedTitle}>Practicing</h1>
            <p className={styles.elapsed}>{formatElapsed(elapsed)} elapsed</p>
            <button className={styles.endBtn} onClick={handleEnd}>End session</button>
          </div>
        </div>
      )
    }

    if (focusStage === 'done' && lastSession) {
      return (
        <div className={styles.focusedPanel}>
          <div className={styles.focusedBlock}>
            <span className={styles.focusedMeta}>session complete</span>
            <h1 className={styles.focusedTitle}>{subjectLabel(lastSession.subject)}</h1>
            <p className={styles.doneMsg}>{formatElapsed(lastSession.duration_seconds * 1000)}</p>
            <button className={styles.restartBtn} onClick={() => setFocusStage('idle')}>
              Start another →
            </button>
          </div>
        </div>
      )
    }
  }

  return (
    <SwipeableCard
      home={<HomePanel overview={overview} />}
      pages={[
        <DetailPanel
          key="detail"
          overview={overview}
          curriculum={curriculum}
          satelliteUrl={satelliteUrl}
          onCurriculumChanged={fetchCurriculum}
          onFocusStart={onFocusRequest ? onFocusRequest : undefined}
        />,
      ]}
    />
  )
}
