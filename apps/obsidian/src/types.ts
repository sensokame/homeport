export interface Book {
  title: string
  author: string
  year: number | null
  added_year: number
  goodreads_url: string
  cover_url: string
  average_rating: string
  user_rating: number
  vault_url: string | null
}

export interface WritingProject {
  name: string
  characters: number
  locations: number
  events: number
  chapters: number
  word_count: number
  recent_activity: number
}

export interface Chapter {
  stem: string
  word_count: number
}

export interface JournalResponse {
  exists: boolean
  content: string
}

export interface ActivityItem {
  name: string
  vault: string
  modified: string
}

export interface MusicToday {
  day: string
  focus: string
  session_shape: string
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
