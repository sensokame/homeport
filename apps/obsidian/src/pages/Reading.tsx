import { useEffect, useState } from 'react'
import { fetchBooks, syncNotes } from '../api'
import type { Book } from '../types'
import styles from './Books.module.css'

function Stars({ n }: { n: number }) {
  if (!n) return null
  return <span className={styles.stars}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
}

function BookCard({ book, onNoteCreated }: { book: Book; onNoteCreated: () => void }) {
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    setCreating(true)
    try {
      await syncNotes()
      onNoteCreated()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={styles.card}>
      {book.cover_url && (
        <img className={styles.cover} src={book.cover_url} alt="" loading="lazy" />
      )}
      <div className={styles.info}>
        <span className={styles.title}>{book.title}</span>
        <span className={styles.author}>{book.author}</span>
        <div className={styles.meta}>
          {book.year && <span>{book.year}</span>}
          {book.average_rating && <span>avg ★ {book.average_rating}</span>}
          <Stars n={book.user_rating} />
        </div>
        <div className={styles.actions}>
          {book.vault_url
            ? <a className={styles.link} href={book.vault_url} target="_blank" rel="noopener">Open in Obsidian →</a>
            : <button className={styles.createBtn} onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create note'}
              </button>
          }
          {book.goodreads_url && (
            <a className={styles.linkMuted} href={book.goodreads_url} target="_blank" rel="noopener">Goodreads →</a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Reading() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetchBooks('currently-reading')
      .then(setBooks)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <p className={styles.muted}>Loading…</p>
  if (!books.length) return <p className={styles.muted}>Nothing on the currently-reading shelf.</p>

  return (
    <div>
      <h1 className={styles.heading}>Currently reading</h1>
      <div className={styles.list}>
        {books.map(b => <BookCard key={b.title} book={b} onNoteCreated={load} />)}
      </div>
    </div>
  )
}
