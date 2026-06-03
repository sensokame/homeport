import { useEffect, useState, useCallback } from 'react'
import { SwipeableCard } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type { Book, ReadingData } from './types'
import styles from './ReadingWidget.module.css'

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

function BookPanel({ book, satelliteUrl, onNoteCreated }: { book: Book; satelliteUrl: string; onNoteCreated: () => void }) {
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

export function ReadingWidget({ satelliteUrl, onStatusChange }: WidgetProps) {
  const [data, setData] = useState<ReadingData | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>
  if (!data) return <div className={styles.panel}><p className={styles.empty}>Unavailable</p></div>

  return (
    <SwipeableCard
      home={<HomePanel data={data} />}
      pages={data.current.map(b => (
        <BookPanel key={b.title} book={b} satelliteUrl={satelliteUrl} onNoteCreated={fetchData} />
      ))}
    />
  )
}
