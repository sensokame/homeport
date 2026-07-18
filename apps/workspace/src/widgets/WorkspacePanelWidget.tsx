import { useEffect, useState } from 'react'
import { SwipeableCard, Select } from '@homeport/ui'
import type { WidgetProps } from '@homeport/ui'
import type { WorkspaceSlot, HubCatalog } from './types'
import styles from './WorkspacePanelWidget.module.css'

function formatSlug(slug: string): string {
  return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function HomePanel({ label, description, slotCount }: { label: string; description?: string | null; slotCount: number }) {
  return (
    <div className={styles.panel}>
      <span className={styles.pageTitle}>{label}</span>
      {description && <p className={styles.description}>{description}</p>}
      <p className={styles.summary}>{slotCount} widget{slotCount !== 1 ? 's' : ''}</p>
    </div>
  )
}

export function WorkspacePanelWidget({ config, renderWidget }: WidgetProps) {
  const label = (config.label as string | undefined) ?? 'Workspace'
  const mode = config.mode as string | undefined
  const manualSlots = (config.slots as WorkspaceSlot[] | undefined) ?? []
  const contextTags = (config.context as { tags?: string[] } | undefined)?.tags ?? []

  // Project mode: the instance's own config.slug is only the *initial* project — the
  // picker below lets the user switch to any other vault project without needing a
  // separate dashboard.json instance per project.
  const [slug, setSlug] = useState<string | undefined>(config.slug as string | undefined)
  useEffect(() => { setSlug(config.slug as string | undefined) }, [config.slug])

  const [projectSlugs, setProjectSlugs] = useState<string[] | null>(null)
  useEffect(() => {
    if (mode !== 'project') return
    let cancelled = false
    // knowledge-sat owns the canonical vault project list. Fetched through the hub's
    // existing generic proxy (same one every widget's satelliteUrl uses), not a
    // satellite-to-satellite backend call.
    fetch('/api/proxy/knowledge/api/projects')
      .then(r => r.json())
      .then((slugs: string[]) => { if (!cancelled) setProjectSlugs(slugs) })
      .catch(() => { if (!cancelled) setProjectSlugs([]) })
    return () => { cancelled = true }
  }, [mode])

  // Description comes from knowledge-sat's idea.md lead paragraph (same generic proxy
  // fetch pattern as the project-slug picker above).
  const [description, setDescription] = useState<string | null>(null)
  useEffect(() => {
    if (mode !== 'project' || !slug) { setDescription(null); return }
    let cancelled = false
    fetch(`/api/proxy/knowledge/api/projects/${encodeURIComponent(slug)}`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then((data: { description?: string | null }) => { if (!cancelled) setDescription(data.description ?? null) })
      .catch(() => { if (!cancelled) setDescription(null) })
    return () => { cancelled = true }
  }, [mode, slug])

  // Auto-discover slots from every satellite that declares provides:["project"] in its
  // own catalog, via the hub's already-aggregated /api/catalog (same-origin fetch —
  // this is a hub endpoint, not a satellite one).
  const [autoSlots, setAutoSlots] = useState<WorkspaceSlot[] | null>(null)

  useEffect(() => {
    if (mode !== 'project' || !slug) { setAutoSlots(null); return }
    let cancelled = false
    fetch('/api/catalog')
      .then(r => r.json())
      .then((data: HubCatalog) => {
        if (cancelled) return
        const providers = data.projectProviders ?? {}
        const order = data.projectOrder ?? {}
        setAutoSlots(
          Object.entries(providers)
            .sort(([a], [b]) => (order[a] ?? 100) - (order[b] ?? 100))
            .map(([satelliteId, widgetId]) => ({
              satelliteId,
              widgetId,
              config: { project_slug: slug },
            }))
        )
      })
      .catch(() => { if (!cancelled) setAutoSlots([]) })
    return () => { cancelled = true }
  }, [mode, slug])

  if (!renderWidget) {
    return <p className={styles.empty}>Composition unavailable — this widget must be embedded by the hub.</p>
  }

  if (mode === 'project') {
    const slots = autoSlots
    const displayLabel = slug ? formatSlug(slug) : label
    return (
      <div className={styles.panel}>
        <Select
          className={styles.projectPicker}
          value={slug ?? ''}
          onChange={e => setSlug(e.target.value || undefined)}
        >
          <option value="">Select a project…</option>
          {(projectSlugs ?? (slug ? [slug] : [])).map(s => (
            <option key={s} value={s}>{formatSlug(s)}</option>
          ))}
        </Select>
        {!slug ? (
          <p className={styles.empty}>Pick a project to view.</p>
        ) : slots === null ? (
          <p className={styles.empty}>Loading…</p>
        ) : slots.length === 0 ? (
          <p className={styles.empty}>No widgets to show.</p>
        ) : (
          <SwipeableCard
            home={<HomePanel label={displayLabel} description={description} slotCount={slots.length} />}
            pages={slots.map((slot, i) => (
              <div key={`${slot.satelliteId}.${slot.widgetId}.${i}`} className={styles.panel}>
                {renderWidget(slot.satelliteId, slot.widgetId, {
                  ...slot.config,
                  workspaceContext: { label: displayLabel, tags: contextTags },
                })}
              </div>
            ))}
          />
        )}
      </div>
    )
  }

  if (manualSlots.length === 0) {
    return <p className={styles.empty}>No widgets to show.</p>
  }

  return (
    <SwipeableCard
      home={<HomePanel label={label} slotCount={manualSlots.length} />}
      pages={manualSlots.map((slot, i) => (
        <div key={`${slot.satelliteId}.${slot.widgetId}.${i}`} className={styles.panel}>
          {renderWidget(slot.satelliteId, slot.widgetId, {
            ...slot.config,
            workspaceContext: { label, tags: contextTags },
          })}
        </div>
      ))}
    />
  )
}
