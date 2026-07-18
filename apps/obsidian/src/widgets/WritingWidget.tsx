import { useEffect, useState, useCallback, useRef } from 'react'
import { SwipeableCard } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type {
  ChapterStatus, WritingChapter, WritingProjectSummary, OpenWritingSession, WritingSession,
} from './types'
import styles from './WritingWidget.module.css'

const DEFAULT_STATUS_VALUES = ['draft', 'revision', 'final']

function statusClass(status: ChapterStatus, statusValues: ChapterStatus[]): string {
  // Only color-code the default draft/revision/final vocabulary — a custom
  // vocabulary (e.g. 100-word-project's drafting/submitted/published/declined)
  // can't be assumed to run from "least" to "most done" by position, so it
  // gets a neutral style instead of a guessed-wrong one.
  if (statusValues.join(',') !== DEFAULT_STATUS_VALUES.join(',')) return styles.statusNeutral
  if (status === 'final') return styles.statusFinal
  if (status === 'revision') return styles.statusRevision
  return styles.statusDraft
}

function statusSummary(counts: WritingProjectSummary['chapter_status_counts'], statusValues: ChapterStatus[]): string {
  return statusValues
    .filter(v => (counts[v] ?? 0) > 0)
    .map(v => `${counts[v]} ${v}`)
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
            <div className={styles.projectNameRow}>
              <span className={styles.projectName}>{p.name.replace(/-/g, ' ')}</span>
              <span className={`${styles.projectStatusBadge} ${statusClass(p.project_status, p.project_status_values)}`}>
                {p.project_status}
              </span>
            </div>
            <div className={styles.projectMeta}>
              {p.shape === 'collection'
                ? `${p.chapters} ${p.chapters === 1 ? 'entry' : 'entries'}`
                : `${p.word_count.toLocaleString()} words`}
              {p.current_streak_days > 0 && ` · ${p.current_streak_days}d streak`}
            </div>
            <div className={styles.statusRow}>{statusSummary(p.chapter_status_counts, p.status_values)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjectPanel({
  project, chapters, satelliteUrl, publicUrl, onChaptersChanged, onProjectChanged, onFocusStart,
}: {
  project: WritingProjectSummary
  chapters: WritingChapter[]
  satelliteUrl: string
  publicUrl: string
  onChaptersChanged: () => void
  onProjectChanged: () => void
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

  async function setProjectStatus(status: ChapterStatus) {
    await fetch(`${satelliteUrl}/api/writing/projects/${project.name}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    onProjectChanged()
  }

  const projectHref = `${publicUrl}/#/writing/${encodeURIComponent(project.name)}`

  return (
    <div className={styles.panel}>
      <div className={styles.projectTitleRow}>
        <a className={styles.projectTitle} href={projectHref} target="_blank" rel="noopener">
          {project.name.replace(/-/g, ' ')}
        </a>
        <select
          className={`${styles.statusSelect} ${statusClass(project.project_status, project.project_status_values)}`}
          value={project.project_status}
          onChange={e => setProjectStatus(e.target.value)}
        >
          {project.project_status_values.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
      <div className={styles.chapterList}>
        {chapters.map(c => (
          <div key={c.stem} className={styles.chapterRow}>
            <a
              className={styles.chapterName}
              href={`${projectHref}/${encodeURIComponent(c.stem)}`}
              target="_blank"
              rel="noopener"
            >
              {c.stem}
            </a>
            <select
              className={`${styles.statusSelect} ${statusClass(c.status, project.status_values)}`}
              value={c.status}
              onChange={e => setStatus(c.stem, e.target.value)}
            >
              {project.status_values.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
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

export function WritingWidget({ satelliteUrl, publicUrl, onStatusChange, onFocusRequest, isFocused }: WidgetProps) {
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
          publicUrl={publicUrl}
          onChaptersChanged={() => fetchChapters(p.name)}
          onProjectChanged={fetchData}
          onFocusStart={onFocusRequest ? handleFocusStart : undefined}
        />
      ))}
    />
  )
}
