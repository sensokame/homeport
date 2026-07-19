export interface ProjectEntry {
  name: string
  status_emoji: string
  status_label: string
  next_action: string
  notes: string
  slug: string | null
}

export interface ProjectCategory {
  name: string
  projects: ProjectEntry[]
}

export interface ProjectsIndex {
  categories: ProjectCategory[]
}

export interface ProjectTaskGroup {
  heading: string | null
  items: string[]
}

export interface ProjectMilestone {
  [column: string]: string
}

export interface ProjectDetail {
  slug: string
  source_file: string
  description: string | null
  tasks: ProjectTaskGroup[]
  milestones: ProjectMilestone[]
  links: string[]
  notes_html: string
}

export interface DevSession {
  started_at: string
  ended_at: string
  duration_seconds: number
}

export interface DevSessionsSummary {
  sessions: DevSession[]
  open_session: { started_at: string } | null
  current_streak_days: number
}
