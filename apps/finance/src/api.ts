import type { FinancePortfolio } from './types'

export async function fetchPortfolio(): Promise<FinancePortfolio> {
  return fetch('/api/portfolio').then(r => r.json())
}
