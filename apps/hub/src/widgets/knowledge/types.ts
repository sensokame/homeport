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
