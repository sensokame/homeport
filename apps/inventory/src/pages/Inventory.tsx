import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Input, Select, Textarea, Modal } from '@homeport/ui'
import type { Item, ItemStatus } from '../types'
import { getItems, createItem, updateItem, deleteItem } from '../api'
import styles from './Inventory.module.css'

const STATUS_VARIANTS: Record<ItemStatus, 'ok' | 'warn' | 'error' | 'default'> = {
  in_stock: 'ok',
  low:      'warn',
  ordered:  'default',
  depleted: 'error',
}

const BLANK: Partial<Item> = {
  name: '', category: '', subcategory: '', quantity: 0,
  unit: 'pcs', location: '', status: 'in_stock', threshold: 0, notes: '',
}

function ItemModal({ item, onSave, onClose }: {
  item: Item | null
  onSave: (data: Partial<Item>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Item>>(item ?? BLANK)
  const [saving, setSaving] = useState(false)

  const set = (k: keyof Item, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <Modal title={item ? 'Edit item' : 'Add item'} onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <Input label="Name *" value={form.name ?? ''} onChange={e => set('name', e.target.value)} required />
        <div className={styles.row}>
          <Input label="Category" value={form.category ?? ''} onChange={e => set('category', e.target.value)} />
          <Input label="Subcategory" value={form.subcategory ?? ''} onChange={e => set('subcategory', e.target.value)} />
        </div>
        <div className={styles.row}>
          <Input label="Quantity" type="number" value={form.quantity ?? 0} onChange={e => set('quantity', +e.target.value)} />
          <Input label="Unit" value={form.unit ?? 'pcs'} onChange={e => set('unit', e.target.value)} />
        </div>
        <div className={styles.row}>
          <Input label="Location" value={form.location ?? ''} onChange={e => set('location', e.target.value)} />
          <Input label="Restock threshold" type="number" value={form.threshold ?? 0} onChange={e => set('threshold', +e.target.value)} />
        </div>
        <Select label="Status" value={form.status ?? 'in_stock'} onChange={e => set('status', e.target.value)}>
          <option value="in_stock">In stock</option>
          <option value="low">Low</option>
          <option value="ordered">Ordered</option>
          <option value="depleted">Depleted</option>
        </Select>
        <Textarea label="Notes" value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
        <div className={styles.formActions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Inventory() {
  const [items, setItems]     = useState<Item[]>([])
  const [search, setSearch]   = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus]   = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState<'add' | Item | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await getItems({
        search: search || undefined,
        category: category || undefined,
        status: status || undefined,
      }))
    } finally { setLoading(false) }
  }, [search, category, status])

  useEffect(() => { load() }, [load])

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))]

  const handleSave = async (data: Partial<Item>) => {
    if (modal && modal !== 'add') await updateItem((modal as Item).id, data)
    else await createItem(data)
    setModal(null)
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return
    await deleteItem(id)
    await load()
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="in_stock">In stock</option>
          <option value="low">Low</option>
          <option value="ordered">Ordered</option>
          <option value="depleted">Depleted</option>
        </Select>
        <Button onClick={() => setModal('add')}>+ Add item</Button>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : items.length === 0 ? (
        <p className={styles.muted}>No items found.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Category</th><th>Qty</th>
                <th>Location</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className={styles.dim}>{item.category || '—'}</td>
                  <td className={styles.mono}>{item.quantity} {item.unit}</td>
                  <td className={styles.dim}>{item.location || '—'}</td>
                  <td><Badge label={item.status} variant={STATUS_VARIANTS[item.status]} /></td>
                  <td className={styles.actions}>
                    <Button size="sm" variant="ghost" onClick={() => setModal(item)}>edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(item.id)}>del</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <ItemModal
          item={modal === 'add' ? null : modal as Item}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
