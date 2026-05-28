export interface Task {
  id: number
  title: string
  project_id: number
  project_name: string
  due_date: string | null
  is_today: boolean
  is_overdue: boolean
  priority: number
}

export interface Project {
  id: number
  title: string
  task_count: number
}
