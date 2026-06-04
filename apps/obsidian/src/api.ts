import type { Book } from './types'

export async function fetchBooks(shelf: string): Promise<Book[]> {
  const r = await fetch(`/api/books?shelf=${encodeURIComponent(shelf)}`)
  return r.json()
}

export async function syncNotes(): Promise<{ created: string[]; skipped: string[] }> {
  const r = await fetch('/api/reading/sync', { method: 'POST' })
  return r.json()
}

export async function createNote(book: Book): Promise<{ vault_url: string | null }> {
  const r = await fetch('/api/notes/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: book.title,
      author: book.author,
      year: book.year,
      added_year: book.added_year,
      goodreads_url: book.goodreads_url,
    }),
  })
  return r.json()
}
