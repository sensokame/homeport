import { useEffect, useState } from 'react'
import { marked } from 'marked'
import { fetchJournal, createJournal, saveJournal, fetchActivity } from '../api'
import type { JournalResponse, ActivityItem } from '../types'
import styles from './Life.module.css'

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function JournalSection() {
  const [journal, setJournal] = useState<JournalResponse | null>(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    fetchJournal().then(j => {
      setJournal(j)
      setContent(j.content)
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    const j = await createJournal()
    setJournal(j)
    setContent(j.content)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveJournal(content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (loading) return <p className={styles.muted}>Loading…</p>

  return (
    <section className={styles.journalSection}>
      <div className={styles.journalHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Today's journal</h2>
          <span className={styles.journalDate}>{today}</span>
        </div>
        {journal?.exists && (
          <div className={styles.previewToggle}>
            <button
              className={[styles.toggleBtn, !preview ? styles.toggleActive : ''].filter(Boolean).join(' ')}
              onClick={() => setPreview(false)}
            >
              Edit
            </button>
            <button
              className={[styles.toggleBtn, preview ? styles.toggleActive : ''].filter(Boolean).join(' ')}
              onClick={() => setPreview(true)}
            >
              Preview
            </button>
          </div>
        )}
      </div>

      {!journal?.exists ? (
        <button className={styles.startBtn} onClick={handleCreate}>
          Start today's journal
        </button>
      ) : preview ? (
        <div
          className={styles.preview}
          dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }}
        />
      ) : (
        <div className={styles.journalEditor}>
          <textarea
            className={styles.textarea}
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={saving}
          />
          <div className={styles.editorActions}>
            {saved && <span className={styles.savedMsg}>Saved</span>}
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function ActivitySection() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActivity().then(setItems).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className={styles.muted}>Loading…</p>

  return (
    <section>
      <h2 className={styles.sectionTitle}>Recent activity (7d)</h2>
      {items.length === 0 ? (
        <p className={styles.muted}>No recent activity.</p>
      ) : (
        <div className={styles.activityList}>
          {items.map((item, i) => (
            <div key={i} className={styles.activityItem}>
              <span className={styles.activityName}>{item.name}</span>
              <div className={styles.activityMeta}>
                <span className={styles.vaultBadge}>{item.vault}</span>
                <span className={styles.activityTime}>{relativeTime(item.modified)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function Life() {
  return (
    <div>
      <JournalSection />
      <ActivitySection />
    </div>
  )
}
