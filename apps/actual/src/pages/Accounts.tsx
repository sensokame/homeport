import { useState, useEffect } from 'react'
import type { Account } from '../types'
import styles from './Accounts.module.css'

function fmt(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/accounts')
      .then(r => {
        if (!r.ok) return r.json().then(e => Promise.reject(e.error))
        return r.json()
      })
      .then(setAccounts)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className={styles.empty}>Loading…</p>
  if (error)   return <p className={styles.empty}>{error}</p>
  if (!accounts.length) return <p className={styles.empty}>No accounts</p>

  const onBudget  = accounts.filter(a => a.on_budget)
  const offBudget = accounts.filter(a => !a.on_budget)
  const netWorth  = accounts.reduce((s, a) => s + a.balance, 0)

  const renderSection = (title: string, items: Account[]) => (
    <div className={styles.section}>
      <span className={styles.sectionTitle}>{title}</span>
      {items.map(a => (
        <div key={a.id} className={styles.row}>
          <span className={styles.name}>{a.name}</span>
          <span className={a.balance < 0 ? styles.negative : styles.positive}>
            {fmt(a.balance)}
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <div className={styles.root}>
      <div className={styles.netWorth}>
        <span className={styles.netLabel}>Net Worth</span>
        <span className={netWorth < 0 ? styles.negative : styles.netValue}>
          {fmt(netWorth)}
        </span>
      </div>

      {onBudget.length  > 0 && renderSection('On Budget',  onBudget)}
      {offBudget.length > 0 && renderSection('Off Budget', offBudget)}
    </div>
  )
}
