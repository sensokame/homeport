import type {
  Book, WritingProject, Chapter, JournalResponse, ActivityItem,
  MusicOverview, MusicCurriculumItem, MusicSession, OpenMusicSession,
} from './types'

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

export async function fetchChapters(project: string): Promise<Chapter[]> {
  const r = await fetch(`/api/writing/projects/${encodeURIComponent(project)}/chapters`)
  return r.json()
}

export async function fetchChapterContent(project: string, chapter: string): Promise<string> {
  const r = await fetch(
    `/api/writing/projects/${encodeURIComponent(project)}/chapters/${encodeURIComponent(chapter)}`
  )
  const data = await r.json()
  return data.content as string
}

export function chapterExportUrl(project: string, chapter: string): string {
  return `/api/writing/projects/${encodeURIComponent(project)}/chapters/${encodeURIComponent(chapter)}/export.pdf`
}

export async function createChapter(project: string, title: string): Promise<void> {
  await fetch(`/api/writing/projects/${encodeURIComponent(project)}/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export async function fetchJournal(): Promise<JournalResponse> {
  const r = await fetch('/api/journal/today')
  return r.json()
}

export async function createJournal(): Promise<JournalResponse> {
  const r = await fetch('/api/journal/today', { method: 'POST' })
  return r.json()
}

export async function saveJournal(content: string): Promise<void> {
  await fetch('/api/journal/today', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

export async function fetchActivity(): Promise<ActivityItem[]> {
  const r = await fetch('/api/activity')
  return r.json()
}

export async function fetchMusicOverview(): Promise<MusicOverview> {
  const r = await fetch('/api/music/overview')
  return r.json()
}

export async function fetchMusicCurriculum(): Promise<MusicCurriculumItem[]> {
  const r = await fetch('/api/music/curriculum/theory')
  return r.json()
}

export async function setMusicCurriculumDone(index: number, done: boolean): Promise<MusicCurriculumItem[]> {
  const r = await fetch(`/api/music/curriculum/theory/${index}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  })
  return r.json()
}

export async function fetchMusicSessions(): Promise<{ sessions: MusicSession[]; open_session: OpenMusicSession | null }> {
  const r = await fetch('/api/music/sessions')
  return r.json()
}

export async function startMusicSession(subject: string): Promise<OpenMusicSession> {
  const r = await fetch('/api/music/sessions/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject }),
  })
  return r.json()
}

export async function endMusicSession(): Promise<MusicSession> {
  const r = await fetch('/api/music/sessions/end', { method: 'POST' })
  return r.json()
}
