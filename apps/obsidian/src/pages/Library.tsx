import { useEffect, useState } from 'react'
import { fetchBooks, createNote } from '../api'
import type { Book } from '../types'
import styles from './Books.module.css'

function Stars({ n }: { n: number }) {
  if (!n) return null
  return <span className={styles.stars}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
}

function BookRow({ book, onNoteCreated }: { book: Book; onNoteCreated: (title: string, url: string) => void }) {
  const [creating, setCreating] = useState(false)
  const [vaultUrl, setVaultUrl] = useState(book.vault_url)

  async function handleCreate() {
    setCreating(true)
    try {
      const result = await createNote(book)
      if (result.vault_url) {
        setVaultUrl(result.vault_url)
        onNoteCreated(book.title, result.vault_url)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={styles.row}>
      {book.cover_url && (
        <img className={styles.coverSmall} src={book.cover_url} alt="" loading="lazy" />
      )}
      <div className={styles.info}>
        <div className={styles.rowTop}>
          <span className={styles.title}>{book.title}</span>
          <Stars n={book.user_rating} />
        </div>
        <span className={styles.author}>{book.author}{book.year ? ` · ${book.year}` : ''}</span>
        <div className={styles.actions}>
          {vaultUrl ? (
            <a className={styles.link} href={vaultUrl} target="_blank" rel="noopener">Open in Obsidian →</a>
          ) : (
            <button className={styles.createBtn} onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create note'}
            </button>
          )}
          {book.goodreads_url && (
            <a className={styles.linkMuted} href={book.goodreads_url} target="_blank" rel="noopener">Goodreads →</a>
          )}
        </div>
      </div>
    </div>
  )
}

interface Props { shelf: 'read' | 'to-read' }

export default function Library({ shelf }: Props) {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setBooks([])
    fetchBooks(shelf).then(setBooks).finally(() => setLoading(false))
  }, [shelf])

  function handleNoteCreated(title: string, url: string) {
    setBooks(prev => prev.map(b => b.title === title ? { ...b, vault_url: url } : b))
  }

  const heading = shelf === 'read' ? 'Read' : 'Want to read'
  const empty = shelf === 'read' ? 'No books on the read shelf.' : 'Nothing on the to-read shelf.'

  if (loading) return <p className={styles.muted}>Loading…</p>
  if (!books.length) return <p className={styles.muted}>{empty}</p>

  return (
    <div>
      <h1 className={styles.heading}>
        {heading} <span className={styles.count}>{books.length}</span>
      </h1>
      <div className={styles.rowList}>
        {books.map(b => (
          <BookRow key={b.title} book={b} onNoteCreated={handleNoteCreated} />
        ))}
      </div>
    </div>
  )
}
