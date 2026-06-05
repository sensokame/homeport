export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  start_time: string
  end_time: string
  traded?: boolean
}

export interface TodayEventsResponse {
  events: CalendarEvent[]
}

export interface WidgetResponse {
  configured: boolean
  current: (CalendarEvent & { traded: boolean }) | null
  next: CalendarEvent | null
}
