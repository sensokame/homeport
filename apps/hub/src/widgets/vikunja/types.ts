export interface VTask {
  id: number
  title: string
  project_id: number
  project_name: string
  due_date: string | null
  is_today: boolean
  is_overdue: boolean
  is_waiting: boolean
  priority: number
}

export interface VProject {
  id: number
  title: string
  task_count: number
  blocked_count: number
  version: string | null
}
