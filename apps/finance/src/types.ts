export interface FinanceHolding {
  isin: string
  name: string
  quantity: number
  valuation: number
  currency: string
}

export interface FinancePortfolio {
  configured: boolean
  error?: string
  totalValue?: number
  cash?: number
  holdings?: FinanceHolding[]
}
