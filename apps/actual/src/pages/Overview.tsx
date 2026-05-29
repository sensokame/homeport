import { useState, useEffect } from 'react'
import { MetricBar, Badge } from '@homeport/ui'
import type { BudgetData, BudgetGroup } from '../types'
import styles from './Overview.module.css'

function fmt(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function spentPct(spent: number, budgeted: number): number {
  if (budgeted <= 0) return spent > 0 ? 100 : 0
  return Math.round((spent / budgeted) * 100)
}

function GroupRow({ group }: { group: BudgetGroup }) {
  const [open, setOpen] = useState(true)
  const pct = spentPct(group.spent, group.budgeted)
  const isOver = group.balance < 0

  return (
    <div className={styles.group}>
      <button className={styles.groupHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.groupName}>{group.name}</span>
        <span className={styles.groupMeta}>
          {isOver && <Badge label="over" variant="error" />}
          <span className={styles.groupAmt}>{fmt(group.spent)} / {fmt(group.budgeted)}</span>
          <span className={styles.chevron}>{open ? '▾' : '▸'}</span>
        </span>
      </button>

      <div className={styles.groupBar}>
        <MetricBar label="" value="" percent={pct} />
      </div>

      {open && (
        <div className={styles.categories}>
          {group.categories.map(cat => {
            const catPct = spentPct(cat.spent, cat.budgeted)
            const catOver = cat.balance < 0
            return (
              <div key={cat.id} className={styles.catRow}>
                <div className={styles.catHeader}>
                  <span className={styles.catName}>{cat.name}</span>
                  <span className={styles.catAmt}>
                    {catOver && <Badge label="over" variant="error" />}
                    <span className={catOver ? styles.amtOver : styles.amtOk}>
                      {fmt(cat.spent)} / {fmt(cat.budgeted)}
                    </span>
                  </span>
                </div>
                <MetricBar label="" value="" percent={catPct} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Overview() {
  const [data, setData] = useState<BudgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/budget')
      .then(r => {
        if (!r.ok) return r.json().then(e => Promise.reject(e.error))
        return r.json()
      })
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className={styles.empty}>Loading…</p>
  if (error)   return <p className={styles.empty}>{error}</p>
  if (!data)   return <p className={styles.empty}>No data</p>

  const [year, month] = data.month.split('-')
  const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleString('en', { month: 'long', year: 'numeric' })

  const totalBudgeted = data.groups.reduce((s, g) => s + g.budgeted, 0)
  const totalSpent    = data.groups.reduce((s, g) => s + g.spent,    0)
  const totalPct      = spentPct(totalSpent, totalBudgeted)

  return (
    <div className={styles.root}>
      <div className={styles.monthHeader}>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <span className={styles.monthSummary}>
          {fmt(totalSpent)} of {fmt(totalBudgeted)}
        </span>
      </div>

      <div className={styles.totalBar}>
        <MetricBar label="Total spent" value={`${totalPct}%`} percent={totalPct} />
      </div>

      <div className={styles.groups}>
        {data.groups.map(g => <GroupRow key={g.id} group={g} />)}
      </div>
    </div>
  )
}
