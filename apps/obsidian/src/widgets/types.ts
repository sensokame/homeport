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

export type ChapterStatus = string

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

export type ProjectShape = 'manuscript' | 'collection'

export interface WritingProjectSummary {
  name: string
  shape: ProjectShape
  status_values: ChapterStatus[]
  project_status: ChapterStatus
  project_status_values: ChapterStatus[]
  characters: number
  locations: number
  events: number
  chapters: number
  word_count: number
  recent_activity: number
  chapter_status_counts: Record<ChapterStatus, number>
  current_streak_days: number
}

export interface MusicScheduleRow {
  day: string
  focus: string
  session_shape: string
}

export interface MusicToday extends MusicScheduleRow {
  subject: string
}

export interface MusicCurriculumItem {
  index: number
  text: string
  done: boolean
}

export interface MusicProgressItem {
  label: string
  status: string
}

export interface MusicProgress {
  ear_training: Record<string, MusicProgressItem>
  scales: Record<string, MusicProgressItem>
  sight_reading: Record<string, MusicProgressItem>
}

export interface MusicSession {
  started_at: string
  ended_at: string
  subject: string
  duration_seconds: number
}

export interface OpenMusicSession {
  started_at: string
  subject: string
}

export interface MusicOverview {
  today: MusicToday | null
  current_streak_days: number
  curriculum_done: number
  curriculum_total: number
  progress: MusicProgress
  last_session: MusicSession | null
  open_session: OpenMusicSession | null
}
