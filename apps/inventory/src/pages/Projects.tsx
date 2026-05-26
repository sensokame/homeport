import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Card, Modal, Input, Select, Textarea } from '@homeport/ui'
import type { Project, Item, ProjectStatus } from '../types'
import { getProjects, createProject, updateProject, deleteProject,
         getProject, getItems, createAssignment, deleteAssignment } from '../api'
import styles from './Projects.module.css'

const STATUS_VARIANTS: Record<ProjectStatus, 'ok' | 'warn' | 'error' | 'default'> = {
  planning: 'default',
  active:   'ok',
  paused:   'warn',
  done:     'default',
}

const BLANK = { name: '', description: '', status: 'planning' as ProjectStatus }

function ProjectModal({ project, onSave, onClose }: {
  project: Project | null
  onSave: (data: Partial<Project>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState(project ? { name: project.name, description: project.description, status: project.status } : BLANK)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }
  return (
    <Modal title={project ? 'Edit project' : 'Add project'} onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <Input label="Name *" value={form.name} onChange={e => set('name', e.target.value)} required />
        <Textarea label="Description" value={form.description} onChange={e => set('description', e.target.value)} />
        <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="done">Done</option>
        </Select>
        <div className={styles.formActions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function AssignModal({ projectId, onSave, onClose }: {
  projectId: string
  onSave: (itemId: string, qty: number, notes: string) => Promise<void>
  onClose: () => void
}) {
  const [items, setItems] = useState<Item[]>([])
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { getItems().then(setItems) }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try { await onSave(itemId, qty, notes) } finally { setSaving(false) }
  }

  return (
    <Modal title="Assign item" onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <Select label="Item *" value={itemId} onChange={e => setItemId(e.target.value)} required>
          <option value="">Select an item…</option>
          {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit} available)</option>)}
        </Select>
        <div className={styles.row}>
          <Input label="Quantity reserved" type="number" value={qty} onChange={e => setQty(+e.target.value)} min={0} />
        </div>
        <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
        <div className={styles.formActions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !itemId}>{saving ? 'Assigning…' : 'Assign'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Projects() {
  const [projects, setProjects]   = useState<Project[]>([])
  const [selected, setSelected]   = useState<Project | null>(null)
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState<'add' | Project | null>(null)
  const [assignModal, setAssignModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setProjects(await getProjects()) } finally { setLoading(false) }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setSelected(await getProject(id))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<Project>) => {
    if (modal && modal !== 'add') await updateProject((modal as Project).id, data)
    else await createProject(data)
    setModal(null)
    await load()
    if (selected) await loadDetail(selected.id)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project and all its assignments?')) return
    await deleteProject(id)
    setSelected(null)
    await load()
  }

  const handleUnassign = async (assignmentId: string) => {
    if (!selected) return
    await deleteAssignment(selected.id, assignmentId)
    await loadDetail(selected.id)
  }

  const handleAssign = async (itemId: string, qty: number, notes: string) => {
    if (!selected) return
    await createAssignment(selected.id, { item_id: itemId, quantity_reserved: qty, notes })
    setAssignModal(false)
    await loadDetail(selected.id)
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Button onClick={() => setModal('add')}>+ Add project</Button>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : projects.length === 0 ? (
        <p className={styles.muted}>No projects yet.</p>
      ) : (
        <div className={styles.grid}>
          {projects.map(p => (
            <Card key={p.id} className={styles.card} onClick={() => { setSelected(null); loadDetail(p.id) }}>
              <div className={styles.cardHeader}>
                <Badge label={p.status} variant={STATUS_VARIANTS[p.status as ProjectStatus]} />
                <span className={styles.cardName}>{p.name}</span>
              </div>
              <p className={styles.cardMeta}>{p.item_count ?? 0} items assigned</p>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <div className={styles.detail}>
          <div className={styles.detailHeader}>
            <span className={styles.detailTitle}>{selected.name}</span>
            <Badge label={selected.status} variant={STATUS_VARIANTS[selected.status]} />
            <Button size="sm" variant="ghost" onClick={() => setModal(selected)}>edit</Button>
            <Button size="sm" variant="danger" onClick={() => handleDelete(selected.id)}>delete</Button>
          </div>
          {selected.description && <p className={styles.detailDesc}>{selected.description}</p>}

          <div className={styles.assignList}>
            {(selected.assignments ?? []).length === 0 ? (
              <p className={styles.muted}>No items assigned.</p>
            ) : (
              selected.assignments!.map(a => (
                <div key={a.id} className={styles.assignRow}>
                  <span className={styles.assignName}>{a.item_name}</span>
                  <span className={styles.assignQty}>× {a.quantity_reserved}</span>
                  {a.notes && <span className={styles.assignQty}>{a.notes}</span>}
                  <Button size="sm" variant="danger" onClick={() => handleUnassign(a.id)}>remove</Button>
                </div>
              ))
            )}
          </div>
          <Button size="sm" onClick={() => setAssignModal(true)}>+ Assign item</Button>
        </div>
      )}

      {modal !== null && (
        <ProjectModal
          project={modal === 'add' ? null : modal as Project}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {assignModal && selected && (
        <AssignModal projectId={selected.id} onSave={handleAssign} onClose={() => setAssignModal(false)} />
      )}
    </div>
  )
}
