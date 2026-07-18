import type { Item, ProjectSummary, ProjectItems, Assignment } from './types'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, opts)
  if (!r.ok) throw new Error(`${r.status}`)
  if (r.status === 204) return undefined as T
  return r.json()
}

function jsonOpts(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

// Items
export function getItems(params?: { category?: string; status?: string; search?: string }) {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v))
  ).toString()
  return req<Item[]>(`/items${q ? '?' + q : ''}`)
}
export const createItem = (data: Partial<Item>) => req<Item>('/items', jsonOpts('POST', data))
export const updateItem = (id: string, data: Partial<Item>) => req<Item>(`/items/${id}`, jsonOpts('PUT', data))
export const deleteItem = (id: string) => req<void>(`/items/${id}`, { method: 'DELETE' })
export const getShoppingList = () => req<Item[]>('/items/shopping-list')

// Projects (identity lives in the vault — inventory only tracks assignments by slug)
export const getProjectSlugs = () => req<ProjectSummary[]>('/projects')
export const getProjectItems = (slug: string) => req<ProjectItems>(`/projects/${slug}/items`)
export const createAssignment = (slug: string, data: { item_id: string; quantity_reserved: number; notes: string }) =>
  req<Assignment>(`/projects/${slug}/assignments`, jsonOpts('POST', data))
export const deleteAssignment = (slug: string, assignmentId: string) =>
  req<void>(`/projects/${slug}/assignments/${assignmentId}`, { method: 'DELETE' })
