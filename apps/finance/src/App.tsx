import { useEffect, useState } from 'react'
import { NavBar, Card } from '@homeport/ui'
import { fetchPortfolio } from './api'
import type { FinancePortfolio } from './types'
import styles from './App.module.css'

function formatEur(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

export default function App() {
  const [portfolio, setPortfolio] = useState<FinancePortfolio | null>(null)

  useEffect(() => {
    fetchPortfolio().then(setPortfolio)
  }, [])

  return (
    <div className={styles.root}>
      <NavBar hostname="finance" links={[]} />
      <main className={styles.main}>
        {portfolio === null ? (
          <p className={styles.muted}>Loading…</p>
        ) : !portfolio.configured ? (
          <div className={styles.setup}>
            <p className={styles.setupTitle}>Not connected</p>
            <p className={styles.muted}>
              {portfolio.error ?? 'No broker connection configured yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className={styles.totals}>
              <span className={styles.totalValue}>{formatEur(portfolio.totalValue ?? 0)}</span>
              <span className={styles.cash}>{formatEur(portfolio.cash ?? 0)} cash</span>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionTitle}>Holdings</span>
              <div className={styles.holdings}>
                {(portfolio.holdings ?? []).map(h => (
                  <Card key={h.isin} className={styles.holdingCard}>
                    <span className={styles.holdingName}>{h.name}</span>
                    <span className={styles.holdingMeta}>{h.quantity} × {h.isin}</span>
                    <span className={styles.holdingValue}>{formatEur(h.valuation)}</span>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
