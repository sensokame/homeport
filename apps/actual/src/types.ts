export interface BudgetCategory {
  id: string
  name: string
  budgeted: number
  spent: number
  balance: number
}

export interface BudgetGroup {
  id: string
  name: string
  budgeted: number
  spent: number
  balance: number
  categories: BudgetCategory[]
}

export interface BudgetData {
  month: string
  groups: BudgetGroup[]
  toBudget: number
}

export interface Account {
  id: string
  name: string
  type: string
  on_budget: boolean
  balance: number
}
