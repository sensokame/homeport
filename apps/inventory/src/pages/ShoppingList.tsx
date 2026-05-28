import { useState, useEffect } from 'react'
import { Button, Badge, Input } from '@homeport/ui'
import type { Item, ItemStatus } from '../types'
import { getShoppingList, updateItem } from '../api'
import styles from './ShoppingList.module.css'

const STATUS_VARIANTS: Record<ItemStatus, 'ok' | 'warn' | 'error' | 'default'> = {
  in_stock: 'ok', low: 'warn', ordered: 'default', depleted: 'error',
}

export default function ShoppingList() {
  const [items, setItems]     = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [qty, setQty]         = useState<Record<string, string>>({})
  const [saving, setSaving]   = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try { setItems(await getShoppingList()) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleUpdate = async (item: Item) => {
    const newQty = parseFloat(qty[item.id] ?? String(item.quantity))
    if (isNaN(newQty)) return
    setSaving(item.id)
    try {
      await updateItem(item.id, { quantity: newQty, status: newQty > item.threshold ? 'in_stock' : item.status })
      await load()
      setQty(q => { const n = { ...q }; delete n[item.id]; return n })
    } finally { setSaving(null) }
  }

  if (loading) return <div className={styles.root}><p className={styles.muted}>Loading…</p></div>

  if (items.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>All stocked up</p>
          <p className={styles.emptyHint}>No items are below threshold or flagged as low/depleted.</p>
        </div>
      </div>
    )
  }

  const needsAction = items.filter(i => i.status !== 'ordered')
  const onOrder     = items.filter(i => i.status === 'ordered')

  return (
    <div className={styles.root}>
      {needsAction.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Needs restocking</h2>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Category</th><th>Current qty</th>
                  <th>Threshold</th><th>Status</th><th>Update qty</th>
                </tr>
              </thead>
              <tbody>
                {needsAction.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td className={styles.dim}>{item.category || '—'}</td>
                    <td className={styles.mono}>
                      {item.available} {item.unit}
                      {item.quantity_reserved > 0 && (
                        <span className={styles.assigned}>{item.quantity} stocked · {item.quantity_reserved} assigned</span>
                      )}
                    </td>
                    <td className={styles.mono}>{item.threshold} {item.unit}</td>
                    <td><Badge label={item.status.replace('_', ' ')} variant={STATUS_VARIANTS[item.status]} /></td>
                    <td>
                      <div className={styles.qtyForm}>
                        <Input
                          className={styles.qtyInput}
                          type="number"
                          placeholder={String(item.quantity)}
                          value={qty[item.id] ?? ''}
                          onChange={e => setQty(q => ({ ...q, [item.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          disabled={saving === item.id || !qty[item.id]}
                          onClick={() => handleUpdate(item)}
                        >
                          {saving === item.id ? '…' : 'Update'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {onOrder.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>On order</h2>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Category</th><th>Qty</th><th>Status</th><th>Update qty</th>
                </tr>
              </thead>
              <tbody>
                {onOrder.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td className={styles.dim}>{item.category || '—'}</td>
                    <td className={styles.mono}>{item.available} {item.unit}</td>
                    <td><Badge label="ordered" variant="default" /></td>
                    <td>
                      <div className={styles.qtyForm}>
                        <Input
                          className={styles.qtyInput}
                          type="number"
                          placeholder={String(item.quantity)}
                          value={qty[item.id] ?? ''}
                          onChange={e => setQty(q => ({ ...q, [item.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          disabled={saving === item.id || !qty[item.id]}
                          onClick={() => handleUpdate(item)}
                        >
                          {saving === item.id ? '…' : 'Received'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
