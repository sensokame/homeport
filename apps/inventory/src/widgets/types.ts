export interface IItem {
  id: string
  name: string
  status: string
  quantity: number
  unit: string
  quantity_reserved: number
  available: number
}

export interface IAssignment {
  item_id: string
  item_name: string
  item_status: string
  quantity_reserved: number
  unit: string
  notes: string
}

export interface IProject {
  slug: string
  assignments: IAssignment[]
}
