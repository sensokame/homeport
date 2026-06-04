import type { Book, WritingProject } from './types'

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

export async function fetchProjects(): Promise<string[]> {
  const r = await fetch('/api/writing/projects')
  return r.json()
}

export async function createProject(name: string): Promise<{ name: string }> {
  const r = await fetch('/api/writing/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return r.json()
}

export async function fetchProject(name: string): Promise<WritingProject> {
  const r = await fetch(`/api/writing/projects/${encodeURIComponent(name)}`)
  return r.json()
}

export async function fetchCharacters(project: string): Promise<string[]> {
  const r = await fetch(`/api/writing/projects/${encodeURIComponent(project)}/characters`)
  return r.json()
}

export async function createCharacter(project: string, name: string): Promise<void> {
  await fetch(`/api/writing/projects/${encodeURIComponent(project)}/characters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export async function fetchChapters(project: string): Promise<string[]> {
  const r = await fetch(`/api/writing/projects/${encodeURIComponent(project)}/chapters`)
  return r.json()
}

export async function createChapter(project: string, title: string): Promise<void> {
  await fetch(`/api/writing/projects/${encodeURIComponent(project)}/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}
