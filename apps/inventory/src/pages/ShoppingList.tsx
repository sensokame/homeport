import { useState, useEffect } from 'react'
import { Button, Badge } from '@homeport/ui'
import type { Item, ItemStatus } from '../types'
import { getShoppingList, updateItem } from '../api'
import styles from './ShoppingList.module.css'

const STATUS_VARIANTS: Record<ItemStatus, 'ok' | 'warn' | 'error' | 'default'> = {
  in_stock: 'ok', low: 'warn', ordered: 'default', depleted: 'error',
}

export default function ShoppingList() {
  const [items, setItems]   = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [qty, setQty]       = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

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

  return (
    <div className={styles.root}>
      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : items.length === 0 ? (
        <p className={styles.muted}>Nothing to restock — all items are above threshold.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Category</th><th>Current qty</th>
              <th>Threshold</th><th>Status</th><th>Update qty</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td className={styles.dim}>{item.category || '—'}</td>
                <td className={styles.mono}>{item.quantity} {item.unit}</td>
                <td className={styles.mono}>{item.threshold} {item.unit}</td>
                <td><Badge label={item.status} variant={STATUS_VARIANTS[item.status]} /></td>
                <td>
                  <div className={styles.qtyForm}>
                    <input
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
                      {saving === item.id ? '…' : 'update'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
