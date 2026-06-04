import { useEffect, useRef, useState } from 'react'
import { fetchProjects, fetchProject, fetchCharacters, createCharacter, fetchChapters, createChapter, createProject } from '../api'
import type { WritingProject } from '../types'
import styles from './Writing.module.css'

type Tab = 'overview' | 'characters' | 'chapters'

function CreateDialog({ title, placeholder, onConfirm, onClose }: {
  title: string
  placeholder: string
  onConfirm: (value: string) => Promise<void>
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleConfirm() {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onConfirm(value.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.dialog}>
        <p className={styles.dialogTitle}>{title}</p>
        <input
          ref={inputRef}
          className={styles.dialogInput}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={saving}
        />
        <div className={styles.dialogActions}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button className={styles.confirmBtn} onClick={handleConfirm} disabled={saving || !value.trim()}>
            {saving ? 'Creating…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProjectDetail({ name, onBack }: { name: string; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [project, setProject] = useState<WritingProject | null>(null)
  const [characters, setCharacters] = useState<string[]>([])
  const [chapters, setChapters] = useState<string[]>([])
  const [dialog, setDialog] = useState<'character' | 'chapter' | null>(null)

  useEffect(() => { fetchProject(name).then(setProject) }, [name])

  useEffect(() => {
    if (tab === 'characters') fetchCharacters(name).then(setCharacters)
    if (tab === 'chapters') fetchChapters(name).then(setChapters)
  }, [tab, name])

  async function handleCreateCharacter(charName: string) {
    await createCharacter(name, charName)
    fetchCharacters(name).then(setCharacters)
    fetchProject(name).then(setProject)
  }

  async function handleCreateChapter(title: string) {
    await createChapter(name, title)
    fetchChapters(name).then(setChapters)
    fetchProject(name).then(setProject)
  }

  const displayName = name.replace(/-/g, ' ')

  const tabNewBtn: Partial<Record<Tab, React.ReactNode>> = {
    characters: <button className={styles.newBtn} onClick={() => setDialog('character')}>+ Character</button>,
    chapters: <button className={styles.newBtn} onClick={() => setDialog('chapter')}>+ Chapter</button>,
  }

  return (
    <div>
      {dialog === 'character' && (
        <CreateDialog
          title="New character"
          placeholder="Character name"
          onConfirm={handleCreateCharacter}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'chapter' && (
        <CreateDialog
          title="New chapter"
          placeholder="Chapter title"
          onConfirm={handleCreateChapter}
          onClose={() => setDialog(null)}
        />
      )}

      <button className={styles.backBtn} onClick={onBack}>← All projects</button>
      <div className={styles.sectionHeader}>
        <h1 className={styles.heading}>{displayName}</h1>
        {tabNewBtn[tab]}
      </div>

      <div className={styles.tabs}>
        {(['overview', 'characters', 'chapters'] as Tab[]).map(t => (
          <button
            key={t}
            className={[styles.tab, tab === t ? styles.tabActive : ''].filter(Boolean).join(' ')}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && project && (
        <div className={styles.overviewGrid}>
          {[
            { label: 'Characters', value: project.characters },
            { label: 'Chapters', value: project.chapters },
            { label: 'Locations', value: project.locations },
            { label: 'Events', value: project.events },
            { label: 'Active (7d)', value: project.recent_activity },
          ].map(s => (
            <div key={s.label} className={styles.overviewCard}>
              <div className={styles.overviewValue}>{s.value}</div>
              <div className={styles.overviewLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'characters' && (
        characters.length === 0
          ? <p className={styles.muted}>No characters yet.</p>
          : (
            <div className={styles.itemList}>
              {characters.map(c => (
                <div key={c} className={styles.item}>{c}</div>
              ))}
            </div>
          )
      )}

      {tab === 'chapters' && (
        chapters.length === 0
          ? <p className={styles.muted}>No chapters yet.</p>
          : (
            <div className={styles.itemList}>
              {chapters.map((c, i) => (
                <div key={c} className={styles.item}>
                  <span>Chapter {i + 1} — {c}</span>
                </div>
              ))}
            </div>
          )
      )}
    </div>
  )
}

export default function Writing() {
  const [projects, setProjects] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [stats, setStats] = useState<Record<string, WritingProject>>({})
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function loadProjects() {
    const ps = await fetchProjects()
    setProjects(ps)
    const entries = await Promise.all(ps.map(p => fetchProject(p).then(s => [p, s] as const)))
    setStats(Object.fromEntries(entries))
  }

  useEffect(() => {
    loadProjects().finally(() => setLoading(false))
  }, [])

  async function handleCreateProject(name: string) {
    const result = await createProject(name)
    await loadProjects()
    setSelected(result.name)
  }

  if (selected) {
    return <ProjectDetail name={selected} onBack={() => setSelected(null)} />
  }

  if (loading) return <p className={styles.muted}>Loading…</p>

  return (
    <div>
      {dialogOpen && (
        <CreateDialog
          title="New project"
          placeholder="Project name"
          onConfirm={handleCreateProject}
          onClose={() => setDialogOpen(false)}
        />
      )}
      <div className={styles.sectionHeader}>
        <h1 className={styles.heading}>Writing projects</h1>
        <button className={styles.newBtn} onClick={() => setDialogOpen(true)}>+ New project</button>
      </div>
      <div className={styles.projectList}>
        {projects.map(p => {
          const s = stats[p]
          return (
            <button key={p} className={styles.projectCard} onClick={() => setSelected(p)}>
              <div className={styles.projectName}>{p.replace(/-/g, ' ')}</div>
              {s && (
                <div className={styles.projectStats}>
                  {[
                    { label: 'Characters', value: s.characters },
                    { label: 'Chapters', value: s.chapters },
                    { label: 'Locations', value: s.locations },
                    { label: 'Events', value: s.events },
                  ].map(stat => (
                    <div key={stat.label} className={styles.stat}>
                      <span className={styles.statValue}>{stat.value}</span>
                      <span className={styles.statLabel}>{stat.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
