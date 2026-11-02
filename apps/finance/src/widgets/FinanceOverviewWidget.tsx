import { useEffect, useState } from 'react'
import { SwipeableCard } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type { FinancePortfolio } from '../types'
import styles from './FinanceOverviewWidget.module.css'

function formatEur(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function HomePanel({ portfolio }: { portfolio: FinancePortfolio }) {
  if (!portfolio.configured) {
    return (
      <div className={styles.panel}>
        <span className={styles.pageTitle}>Finance</span>
        <p className={styles.empty}>
          {portfolio.error ?? 'Not connected yet.'}
        </p>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <span className={styles.pageTitle}>Finance</span>
      <div className={styles.totals}>
        <span className={styles.totalValue}>{formatEur(portfolio.totalValue ?? 0)}</span>
        <span className={styles.cash}>{formatEur(portfolio.cash ?? 0)} cash</span>
      </div>
      <ul className={styles.holdings}>
        {(portfolio.holdings ?? []).map(h => (
          <li key={h.isin} className={styles.holdingRow}>
            <span className={styles.holdingName}>{h.name}</span>
            <span className={styles.holdingValue}>{formatEur(h.valuation)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FinanceOverviewWidget({ satelliteUrl, onStatusChange }: WidgetProps) {
  const [portfolio, setPortfolio] = useState<FinancePortfolio | null>(null)

  useEffect(() => {
    fetch(`${satelliteUrl}/api/portfolio`)
      .then(r => r.json())
      .then((p: FinancePortfolio) => {
        setPortfolio(p)
        onStatusChange?.(p.configured ? 'ok' : 'warn')
      })
      .catch(() => onStatusChange?.('error'))
  }, [satelliteUrl])

  if (portfolio === null) {
    return <div className={styles.panel}><p className={styles.empty}>Loading…</p></div>
  }

  return <SwipeableCard home={<HomePanel portfolio={portfolio} />} />
}
