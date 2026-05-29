import { useState, useEffect } from 'react'
import { Button, Badge } from '@homeport/ui'
import type { Item, ItemStatus } from '../types'
import { getShoppingList, updateItem } from '../api'
import styles from './ShoppingList.module.css'

const STATUS_VARIANTS: Record<ItemStatus, 'ok' | 'warn' | 'error' | 'default'> = {
  in_stock: 'ok', low: 'warn', ordered: 'default', depleted: 'error', needed: 'warn',
}

function defaultOrderQty(item: Item): number {
  if (item.threshold > 0) return Math.max(1, Math.ceil(item.threshold - item.available))
  return 1
}

export default function Manage() {
  const [items, setItems]           = useState<Item[]>([])
  const [loading, setLoading]       = useState(true)
  const [busy, setBusy]             = useState<string | null>(null)
  const [ordering, setOrdering]     = useState<string | null>(null)
  const [orderQty, setOrderQty]     = useState<Record<string, string>>({})
  const [revealing, setRevealing]   = useState<string | null>(null)
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    try { setItems(await getShoppingList()) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openOrder = (item: Item) => {
    setOrderQty(q => ({ ...q, [item.id]: String(defaultOrderQty(item)) }))
    setOrdering(item.id)
  }

  const handleOrder = async (item: Item) => {
    const qty = parseFloat(orderQty[item.id] ?? '')
    if (isNaN(qty) || qty <= 0) return
    setBusy(item.id)
    try {
      await updateItem(item.id, { status: 'ordered', quantity_on_order: qty })
      setOrdering(null)
      setOrderQty(q => { const n = { ...q }; delete n[item.id]; return n })
      await load()
    } finally { setBusy(null) }
  }

  const handleCancel = async (item: Item) => {
    setBusy(item.id)
    const status = item.quantity > 0 ? 'depleted' : 'needed'
    try {
      await updateItem(item.id, { status, quantity_on_order: 0 })
      await load()
    } finally { setBusy(null) }
  }

  const openReceive = (item: Item) => {
    setReceiveQty(q => ({ ...q, [item.id]: item.quantity_on_order > 0 ? String(item.quantity_on_order) : '' }))
    setRevealing(item.id)
  }

  const handleReceive = async (item: Item) => {
    const qty = parseFloat(receiveQty[item.id] ?? '')
    if (isNaN(qty) || qty < 0) return
    setBusy(item.id)
    try {
      await updateItem(item.id, { quantity: qty, status: 'in_stock', quantity_on_order: 0 })
      setRevealing(null)
      setReceiveQty(q => { const n = { ...q }; delete n[item.id]; return n })
      await load()
    } finally { setBusy(null) }
  }

  if (loading) return <div className={styles.root}><p className={styles.muted}>Loading…</p></div>

  const needsOrdering = items.filter(i => i.status !== 'ordered')
  const onOrder       = items.filter(i => i.status === 'ordered')

  if (items.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>All stocked up</p>
          <p className={styles.emptyHint}>No items need attention.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {needsOrdering.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Needs ordering</h2>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Category</th><th>In stock</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {needsOrdering.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td className={styles.dim}>{item.category || '—'}</td>
                    <td className={styles.mono}>
                      {item.quantity} {item.unit}
                      {item.quantity_reserved > 0 && (
                        <span className={styles.assigned}>{item.quantity_reserved} reserved</span>
                      )}
                      {item.threshold > 0 && (
                        <span className={styles.assigned}>need {item.threshold} {item.unit}</span>
                      )}
                    </td>
                    <td><Badge label={item.status.replace('_', ' ')} variant={STATUS_VARIANTS[item.status]} /></td>
                    <td>
                      {ordering === item.id ? (
                        <div className={styles.qtyForm}>
                          <input
                            className={styles.qtyInput}
                            type="number"
                            min="1"
                            autoFocus
                            value={orderQty[item.id] ?? ''}
                            onChange={e => setOrderQty(q => ({ ...q, [item.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleOrder(item); if (e.key === 'Escape') setOrdering(null) }}
                          />
                          <span className={styles.unit}>{item.unit}</span>
                          <div className={styles.btnHint}>
                            <Button size="sm" disabled={busy === item.id || !orderQty[item.id]} onClick={() => handleOrder(item)}>
                              {busy === item.id ? '…' : 'Confirm'}
                            </Button>
                            <span className={styles.hint}>
                              → ordered · {orderQty[item.id] ? `${orderQty[item.id]} ${item.unit}` : '?'}
                            </span>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => setOrdering(null)}>✕</Button>
                        </div>
                      ) : (
                        <div className={styles.btnHint}>
                          <Button size="sm" variant="secondary" disabled={busy === item.id} onClick={() => openOrder(item)}>
                            Order
                          </Button>
                          <span className={styles.hint}>→ ordered</span>
                        </div>
                      )}
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
                  <th>Name</th><th>Category</th><th>In stock</th><th>On order</th><th></th>
                </tr>
              </thead>
              <tbody>
                {onOrder.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td className={styles.dim}>{item.category || '—'}</td>
                    <td className={styles.mono}>
                      {item.quantity} {item.unit}
                      {item.quantity_reserved > 0 && (
                        <span className={styles.assigned}>{item.quantity_reserved} reserved</span>
                      )}
                    </td>
                    <td className={styles.mono}>
                      {item.quantity_on_order > 0 ? `${item.quantity_on_order} ${item.unit}` : '—'}
                    </td>
                    <td>
                      {revealing === item.id ? (
                        <div className={styles.qtyForm}>
                          <input
                            className={styles.qtyInput}
                            type="number"
                            min="0"
                            placeholder="qty received"
                            autoFocus
                            value={receiveQty[item.id] ?? ''}
                            onChange={e => setReceiveQty(q => ({ ...q, [item.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleReceive(item); if (e.key === 'Escape') setRevealing(null) }}
                          />
                          <span className={styles.unit}>{item.unit}</span>
                          <div className={styles.btnHint}>
                            <Button size="sm" disabled={busy === item.id || !receiveQty[item.id]} onClick={() => handleReceive(item)}>
                              {busy === item.id ? '…' : 'Confirm'}
                            </Button>
                            <span className={styles.hint}>
                              → in_stock · {receiveQty[item.id] ? `${receiveQty[item.id]} ${item.unit}` : '?'}
                            </span>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => setRevealing(null)}>✕</Button>
                        </div>
                      ) : (
                        <div className={styles.actions}>
                          <div className={styles.btnHint}>
                            <Button size="sm" disabled={busy === item.id} onClick={() => openReceive(item)}>
                              Received
                            </Button>
                            <span className={styles.hint}>→ in_stock</span>
                          </div>
                          <div className={styles.btnHint}>
                            <Button size="sm" variant="secondary" disabled={busy === item.id} onClick={() => handleCancel(item)}>
                              Cancel order
                            </Button>
                            <span className={styles.hint}>→ {item.quantity > 0 ? 'depleted' : 'needed'}</span>
                          </div>
                        </div>
                      )}
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
