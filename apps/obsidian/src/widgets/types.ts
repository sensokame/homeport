export interface Book {
  title: string
  author: string
  year: number | null
  added_year: number
  goodreads_url: string
  cover_url: string
  average_rating: string
  vault_url: string | null
}

export interface ReadingData {
  current: Book[]
  read_by_year: Record<string, number>
  total_read: number
}

export type ChapterStatus = 'draft' | 'revision' | 'final'

export interface WritingChapter {
  stem: string
  word_count: number
  status: ChapterStatus
}

export interface WritingSession {
  started_at: string
  ended_at: string
  word_count_start: number
  word_count_end: number
  delta: number
  duration_seconds: number
}

export interface OpenWritingSession {
  started_at: string
  word_count_start: number
}

export interface WritingProjectSummary {
  name: string
  characters: number
  locations: number
  events: number
  chapters: number
  word_count: number
  recent_activity: number
  chapter_status_counts: Record<ChapterStatus, number>
  current_streak_days: number
}
