import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Modal, Input, Select } from '@homeport/ui'
import type { ProjectSummary, ProjectItems, Item } from '../types'
import { getProjectSlugs, getProjectItems, getItems, createAssignment, deleteAssignment } from '../api'
import styles from './Projects.module.css'

function formatSlug(slug: string): string {
  return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function AssignModal({ slug, knownSlugs, onSave, onClose }: {
  slug: string | null
  knownSlugs: string[]
  onSave: (slug: string, itemId: string, qty: number, notes: string) => Promise<void>
  onClose: () => void
}) {
  const [items, setItems] = useState<Item[]>([])
  const [slugInput, setSlugInput] = useState(slug ?? '')
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { getItems().then(setItems) }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try { await onSave(slugInput.trim(), itemId, qty, notes) } finally { setSaving(false) }
  }

  return (
    <Modal title="Assign item to project" onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        {slug === null ? (
          <>
            <Input
              label="Project slug *"
              value={slugInput}
              onChange={e => setSlugInput(e.target.value)}
              placeholder="e.g. home-server"
              list="project-slugs"
              required
            />
            <datalist id="project-slugs">
              {knownSlugs.map(s => <option key={s} value={s} />)}
            </datalist>
            <p className={styles.hint}>Must match a vault project folder name exactly (`Projects/projects/&lt;slug&gt;/`).</p>
          </>
        ) : (
          <p className={styles.hint}>Assigning to <strong>{formatSlug(slug)}</strong></p>
        )}
        <Select label="Item *" value={itemId} onChange={e => setItemId(e.target.value)} required>
          <option value="">Select an item…</option>
          {items.filter(i => (i.available ?? i.quantity) > 0).map(i => <option key={i.id} value={i.id}>{i.name} ({i.available ?? i.quantity} {i.unit} available)</option>)}
        </Select>
        <div className={styles.row}>
          <Input label="Quantity reserved" type="number" value={qty} onChange={e => setQty(+e.target.value)} min={0} />
        </div>
        <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
        <div className={styles.formActions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !itemId || !slugInput.trim()}>{saving ? 'Assigning…' : 'Assign'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Projects() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [selected, setSelected] = useState<ProjectItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [assignModal, setAssignModal] = useState<'new' | 'selected' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setProjects(await getProjectSlugs()) } finally { setLoading(false) }
  }, [])

  const loadDetail = useCallback(async (slug: string) => {
    setSelected(await getProjectItems(slug))
  }, [])

  useEffect(() => { load() }, [load])

  const handleUnassign = async (assignmentId: string) => {
    if (!selected) return
    await deleteAssignment(selected.slug, assignmentId)
    await loadDetail(selected.slug)
    await load()
  }

  const handleAssign = async (slug: string, itemId: string, qty: number, notes: string) => {
    await createAssignment(slug, { item_id: itemId, quantity_reserved: qty, notes })
    setAssignModal(null)
    await load()
    if (selected?.slug === slug || assignModal === 'new') await loadDetail(slug)
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Button onClick={() => setAssignModal('new')}>+ Assign item to project</Button>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : projects.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No project assignments yet</p>
          <p className={styles.emptyHint}>Assign an item to a vault project slug to start tracking it here.</p>
          <Button onClick={() => setAssignModal('new')}>+ Assign item to project</Button>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map(p => (
            <Card
              key={p.slug}
              className={`${styles.card} ${selected?.slug === p.slug ? styles.cardSelected : ''}`}
              onClick={() => { setSelected(null); loadDetail(p.slug) }}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardName}>{formatSlug(p.slug)}</span>
              </div>
              <p className={styles.cardMeta}>{p.item_count} item{p.item_count !== 1 ? 's' : ''} assigned</p>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <div className={styles.detail}>
          <div className={styles.detailHeader}>
            <span className={styles.detailTitle}>{formatSlug(selected.slug)}</span>
            <a
              className={styles.workspaceLink}
              href={`http://panel.station/#/workspace/${encodeURIComponent(selected.slug)}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in workspace →
            </a>
          </div>

          <div className={styles.assignSection}>
            <div className={styles.assignHeader}>
              <span className={styles.assignTitle}>Assigned items</span>
              <Button size="sm" onClick={() => setAssignModal('selected')}>+ Assign item</Button>
            </div>
            <div className={styles.assignList}>
              {selected.assignments.length === 0 ? (
                <p className={styles.muted}>No items assigned yet.</p>
              ) : (
                selected.assignments.map(a => (
                  <div key={a.id} className={styles.assignRow}>
                    <span className={styles.assignName}>{a.item_name}</span>
                    <span className={styles.assignQty}>× {a.quantity_reserved}</span>
                    {a.notes && <span className={styles.assignNote}>{a.notes}</span>}
                    <Button size="sm" variant="danger" onClick={() => handleUnassign(a.id)}>Remove</Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {assignModal !== null && (
        <AssignModal
          slug={assignModal === 'selected' ? selected!.slug : null}
          knownSlugs={projects.map(p => p.slug)}
          onSave={handleAssign}
          onClose={() => setAssignModal(null)}
        />
      )}
    </div>
  )
}
