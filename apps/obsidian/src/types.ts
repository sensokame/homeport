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
