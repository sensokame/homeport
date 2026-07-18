import { useEffect, useState, useCallback, useRef } from 'react'
import { SwipeableCard } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type {
  ChapterStatus, WritingChapter, WritingProjectSummary, OpenWritingSession, WritingSession,
} from './types'
import styles from './WritingWidget.module.css'

const STATUS_LABEL: Record<ChapterStatus, string> = {
  draft: 'draft', revision: 'revision', final: 'final',
}

function statusClass(status: ChapterStatus): string {
  if (status === 'final') return styles.statusFinal
  if (status === 'revision') return styles.statusRevision
  return styles.statusDraft
}

function statusSummary(counts: WritingProjectSummary['chapter_status_counts']): string {
  return (['final', 'revision', 'draft'] as const)
    .filter(k => counts[k] > 0)
    .map(k => `${counts[k]} ${k}`)
    .join(' · ')
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

function HomePanel({ projects }: { projects: WritingProjectSummary[] }) {
  return (
    <div className={styles.panel}>
      <span className={styles.pageTitle}>Writing</span>
      <p className={styles.summary}>
        {projects.length} project{projects.length === 1 ? '' : 's'}
      </p>
      <div className={styles.projectList}>
        {projects.map(p => (
          <div key={p.name} className={styles.projectRow}>
            <div className={styles.projectName}>{p.name.replace(/-/g, ' ')}</div>
            <div className={styles.projectMeta}>
              {p.word_count.toLocaleString()} words
              {p.current_streak_days > 0 && ` · ${p.current_streak_days}d streak`}
            </div>
            <div className={styles.statusRow}>{statusSummary(p.chapter_status_counts)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjectPanel({
  project, chapters, satelliteUrl, onChaptersChanged, onFocusStart,
}: {
  project: WritingProjectSummary
  chapters: WritingChapter[]
  satelliteUrl: string
  onChaptersChanged: () => void
  onFocusStart?: (project: WritingProjectSummary) => void
}) {
  async function setStatus(stem: string, status: ChapterStatus) {
    await fetch(`${satelliteUrl}/api/writing/projects/${project.name}/chapters/${encodeURIComponent(stem)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    onChaptersChanged()
  }

  return (
    <div className={styles.panel}>
      <span className={styles.projectTitle}>{project.name.replace(/-/g, ' ')}</span>
      <div className={styles.chapterList}>
        {chapters.map(c => (
          <div key={c.stem} className={styles.chapterRow}>
            <span className={styles.chapterName}>{c.stem}</span>
            <select
              className={`${styles.statusSelect} ${statusClass(c.status)}`}
              value={c.status}
              onChange={e => setStatus(c.stem, e.target.value as ChapterStatus)}
            >
              <option value="draft">{STATUS_LABEL.draft}</option>
              <option value="revision">{STATUS_LABEL.revision}</option>
              <option value="final">{STATUS_LABEL.final}</option>
            </select>
          </div>
        ))}
        {chapters.length === 0 && <p className={styles.empty}>No chapters yet</p>}
      </div>
      {onFocusStart && (
        <button className={styles.focusStartBtn} onClick={() => onFocusStart(project)}>
          Start session →
        </button>
      )}
    </div>
  )
}

type FocusStage = 'idle' | 'active' | 'done'

export function WritingWidget({ satelliteUrl, onStatusChange, onFocusRequest, isFocused }: WidgetProps) {
  const [projects, setProjects] = useState<WritingProjectSummary[] | null>(null)
  const [chaptersByProject, setChaptersByProject] = useState<Record<string, WritingChapter[]>>({})
  const [loading, setLoading] = useState(true)

  const [focusedProject, setFocusedProject] = useState<WritingProjectSummary | null>(null)
  const [focusStage, setFocusStage] = useState<FocusStage>('idle')
  const [openSession, setOpenSession] = useState<OpenWritingSession | null>(null)
  const [lastSession, setLastSession] = useState<WritingSession | null>(null)
  const [tick, setTick] = useState(0)

  const fetchChapters = useCallback((name: string) => {
    fetch(`${satelliteUrl}/api/writing/projects/${name}/chapters`)
      .then(r => r.json())
      .then((c: WritingChapter[]) => setChaptersByProject(prev => ({ ...prev, [name]: c })))
  }, [satelliteUrl])

  const fetchData = useCallback(() => {
    fetch(`${satelliteUrl}/api/writing/projects`)
      .then(r => r.json())
      .then((names: string[]) =>
        Promise.all(names.map(n => fetch(`${satelliteUrl}/api/writing/projects/${n}`).then(r => r.json())))
      )
      .then((summaries: WritingProjectSummary[]) => {
        setProjects(summaries)
        summaries.forEach(p => fetchChapters(p.name))
        onStatusChange?.('ok')
      })
      .catch(() => onStatusChange?.('error'))
      .finally(() => setLoading(false))
  }, [satelliteUrl, fetchChapters])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!isFocused) {
      setFocusStage('idle')
      setOpenSession(null)
      setLastSession(null)
      return
    }
    if (!focusedProject) return
    fetch(`${satelliteUrl}/api/writing/projects/${focusedProject.name}/sessions`)
      .then(r => r.json())
      .then((d: { open_session: OpenWritingSession | null }) => {
        if (d.open_session) {
          setOpenSession(d.open_session)
          setFocusStage('active')
        }
      })
  }, [isFocused, focusedProject, satelliteUrl])

  useEffect(() => {
    if (focusStage !== 'active') return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [focusStage])

  function handleFocusStart(project: WritingProjectSummary) {
    setFocusedProject(project)
    onFocusRequest?.()
  }

  async function handleStart() {
    if (!focusedProject) return
    const res = await fetch(`${satelliteUrl}/api/writing/projects/${focusedProject.name}/sessions/start`, { method: 'POST' })
    if (res.ok) {
      setOpenSession(await res.json())
      setFocusStage('active')
    }
  }

  async function handleEnd() {
    if (!focusedProject) return
    const res = await fetch(`${satelliteUrl}/api/writing/projects/${focusedProject.name}/sessions/end`, { method: 'POST' })
    if (res.ok) {
      setLastSession(await res.json())
      setFocusStage('done')
      fetchData()
    }
  }

  if (loading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>
  if (!projects) return <div className={styles.panel}><p className={styles.empty}>Unavailable</p></div>

  if (isFocused && focusedProject) {
    if (focusStage === 'idle') {
      return (
        <div className={styles.focusedPanel}>
          <div className={styles.focusedBlock}>
            <span className={styles.focusedMeta}>writing session</span>
            <h1 className={styles.focusedTitle}>{focusedProject.name.replace(/-/g, ' ')}</h1>
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
            <span className={styles.focusedMeta}>writing</span>
            <h1 className={styles.focusedTitle}>{focusedProject.name.replace(/-/g, ' ')}</h1>
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
            <h1 className={styles.focusedTitle}>{focusedProject.name.replace(/-/g, ' ')}</h1>
            <p className={styles.doneMsg}>
              {lastSession.delta >= 0 ? `${lastSession.delta} words written` : `${-lastSession.delta} words removed`}
              {' · '}{formatElapsed(lastSession.duration_seconds * 1000)}
            </p>
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
      home={<HomePanel projects={projects} />}
      pages={projects.map(p => (
        <ProjectPanel
          key={p.name}
          project={p}
          chapters={chaptersByProject[p.name] || []}
          satelliteUrl={satelliteUrl}
          onChaptersChanged={() => fetchChapters(p.name)}
          onFocusStart={onFocusRequest ? handleFocusStart : undefined}
        />
      ))}
    />
  )
}
