export type ItemStatus = 'in_stock' | 'low' | 'ordered' | 'depleted'
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'done'

export interface Item {
  id: string
  name: string
  category: string
  subcategory: string
  quantity: number
  quantity_reserved: number
  available: number
  unit: string
  location: string
  status: ItemStatus
  threshold: number
  specs: Record<string, string>
  notes: string
  created_at: string
  updated_at: string
}

export interface Assignment {
  id: string
  item_id: string
  item_name: string
  quantity_reserved: number
  notes: string
}

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  created_at: string
  updated_at: string
  item_count?: number
  assignments?: Assignment[]
}
