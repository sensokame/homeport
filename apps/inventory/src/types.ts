export type ItemStatus = 'in_stock' | 'low' | 'ordered' | 'depleted' | 'needed'

export interface Item {
  id: string
  name: string
  category: string
  subcategory: string
  quantity: number
  quantity_reserved: number
  quantity_on_order: number
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
  // Present on GET /api/projects/{slug}/items, absent on the assignment-create response.
  item_status?: ItemStatus
  unit?: string
}

// Project identity lives in the vault (Projects/projects/<slug>/) — inventory only
// stores item assignments scoped by slug, it doesn't own name/description/status.
export interface ProjectSummary {
  slug: string
  item_count: number
}

export interface ProjectItems {
  slug: string
  assignments: Assignment[]
}
