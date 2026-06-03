import type { Book } from './types'

export async function fetchBooks(shelf: string): Promise<Book[]> {
  const r = await fetch(`/api/books?shelf=${encodeURIComponent(shelf)}`)
  return r.json()
}

export async function syncNotes(): Promise<{ created: string[]; skipped: string[] }> {
  const r = await fetch('/api/reading/sync', { method: 'POST' })
  return r.json()
}
