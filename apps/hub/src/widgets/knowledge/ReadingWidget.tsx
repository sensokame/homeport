import { useEffect, useState, useCallback, useRef } from 'react'
import { SwipeableCard } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type { Book, ReadingData } from './types'
import styles from './ReadingWidget.module.css'

const DURATION_KEY = 'reading-focus-duration'

function getDefaultDuration() {
  try { return parseInt(localStorage.getItem(DURATION_KEY) || '25') || 25 }
  catch { return 25 }
}

function formatRemaining(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function HomePanel({ data }: { data: ReadingData }) {
  const years = Object.entries(data.read_by_year).sort(([a], [b]) => Number(a) - Number(b))
  const yearStr = years.map(([y, n]) => `${y}: ${n}`).join(' · ')

  return (
    <div className={styles.panel}>
      <span className={styles.pageTitle}>Reading</span>
      <p className={styles.summary}>
        {data.current.length} reading{data.total_read > 0 ? ` · ${data.total_read} in vault` : ''}
      </p>
      {yearStr && <p className={styles.yearRow}>{yearStr}</p>}
      <div className={styles.currentList}>
        {data.current.map(b => (
          <div key={b.title}>
            <div className={styles.currentItem}>{b.title}</div>
            <div className={styles.currentAuthor}>{b.author}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BookPanel({
  book, satelliteUrl, onNoteCreated, onFocusStart,
}: {
  book: Book
  satelliteUrl: string
  onNoteCreated: () => void
  onFocusStart?: (book: Book) => void
}) {
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    setCreating(true)
    try {
      await fetch(`${satelliteUrl}/api/reading/sync`, { method: 'POST' })
      onNoteCreated()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={styles.panel}>
      <span className={styles.bookTitle}>{book.title}</span>
      <div className={styles.bookMeta}>
        <span className={styles.metaRow}>
          <span className={styles.metaLabel}>Author </span>
          <span className={styles.metaValue}>{book.author || '—'}</span>
        </span>
        {book.year && (
          <span className={styles.metaRow}>
            <span className={styles.metaLabel}>Published </span>
            <span className={styles.metaValue}>{book.year}</span>
          </span>
        )}
        {book.average_rating && (
          <span className={styles.metaRow}>
            <span className={styles.metaLabel}>Rating </span>
            <span className={styles.metaValue}>★ {book.average_rating}</span>
          </span>
        )}
      </div>
      <div className={styles.links}>
        {onFocusStart && (
          <button className={styles.focusStartBtn} onClick={() => onFocusStart(book)}>
            Focus session →
          </button>
        )}
        {book.vault_url ? (
          <a className={styles.link} href={book.vault_url} target="_blank" rel="noopener">Open in Obsidian →</a>
        ) : (
          <button className={styles.createBtn} onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create note'}
          </button>
        )}
        {book.goodreads_url && (
          <a className={styles.link} href={book.goodreads_url} target="_blank" rel="noopener">View on Goodreads →</a>
        )}
      </div>
    </div>
  )
}

type FocusStage = 'pick' | 'timer' | 'done'

export function ReadingWidget({ satelliteUrl, onStatusChange, onFocusRequest, isFocused }: WidgetProps) {
  const [data, setData] = useState<ReadingData | null>(null)
  const [loading, setLoading] = useState(true)

  const [focusedBook, setFocusedBook] = useState<Book | null>(null)
  const [focusStage, setFocusStage] = useState<FocusStage>('pick')
  const [duration, setDuration] = useState(getDefaultDuration)
  const [timerStart, setTimerStart] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(() => {
    fetch(`${satelliteUrl}/api/reading`)
      .then(r => r.json())
      .then((d: ReadingData) => {
        setData(d)
        onStatusChange?.('ok')
      })
      .catch(() => onStatusChange?.('error'))
      .finally(() => setLoading(false))
  }, [satelliteUrl])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!isFocused) {
      setFocusStage('pick')
      setTimerStart(null)
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
    }
  }, [isFocused])

  // 30s tick for countdown display while timer is running
  useEffect(() => {
    if (!isFocused || focusStage !== 'timer') return
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [isFocused, focusStage])

  // Exact timeout to flip to 'done' stage
  useEffect(() => {
    if (focusStage !== 'timer' || !timerStart) return
    const remaining = duration * 60_000 - (Date.now() - timerStart)
    if (remaining <= 0) { setFocusStage('done'); return }
    doneTimerRef.current = setTimeout(() => setFocusStage('done'), remaining)
    return () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current) }
  }, [focusStage, timerStart, duration])

  function handleFocusStart(book: Book) {
    setFocusedBook(book)
    onFocusRequest?.()
  }

  function handleStart() {
    try { localStorage.setItem(DURATION_KEY, String(duration)) } catch { /* ignore */ }
    setTimerStart(Date.now())
    setFocusStage('timer')
  }

  if (loading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>
  if (!data) return <div className={styles.panel}><p className={styles.empty}>Unavailable</p></div>

  if (isFocused && focusedBook) {
    if (focusStage === 'pick') {
      return (
        <div className={styles.focusedPanel}>
          <div className={styles.focusedBlock}>
            <span className={styles.focusedMeta}>reading session</span>
            <h1 className={styles.focusedTitle}>{focusedBook.title}</h1>
            {focusedBook.author && <p className={styles.focusedAuthor}>{focusedBook.author}</p>}
            <div className={styles.durationRow}>
              <input
                className={styles.durationInput}
                type="number"
                min={1}
                max={240}
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value) || 25)}
              />
              <span className={styles.durationUnit}>min</span>
              <button className={styles.startBtn} onClick={handleStart}>Start →</button>
            </div>
          </div>
        </div>
      )
    }

    if (focusStage === 'timer' && timerStart !== null) {
      void tick
      const elapsed = Date.now() - timerStart
      const totalMs = duration * 60_000
      const remaining = Math.max(0, totalMs - elapsed)
      const progress = Math.min(100, (elapsed / totalMs) * 100)

      return (
        <div className={styles.focusedPanel}>
          <div className={styles.focusedBlock}>
            <span className={styles.focusedMeta}>reading</span>
            <h1 className={styles.focusedTitle}>{focusedBook.title}</h1>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <p className={styles.remaining}>{formatRemaining(remaining)} remaining</p>
          </div>
        </div>
      )
    }

    if (focusStage === 'done') {
      return (
        <div className={styles.focusedPanel}>
          <div className={styles.focusedBlock}>
            <span className={styles.focusedMeta}>session complete</span>
            <h1 className={styles.focusedTitle}>{focusedBook.title}</h1>
            <p className={styles.doneMsg}>{duration} min of reading done.</p>
            <button className={styles.restartBtn} onClick={() => setFocusStage('pick')}>
              Start another →
            </button>
          </div>
        </div>
      )
    }
  }

  return (
    <SwipeableCard
      home={<HomePanel data={data} />}
      pages={data.current.map(b => (
        <BookPanel
          key={b.title}
          book={b}
          satelliteUrl={satelliteUrl}
          onNoteCreated={fetchData}
          onFocusStart={onFocusRequest ? handleFocusStart : undefined}
        />
      ))}
    />
  )
}
