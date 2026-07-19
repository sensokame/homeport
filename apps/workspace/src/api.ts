import type { ProjectDetail, ProjectsIndex } from './types'

// Match the page's own protocol — a plain-HTTP fetch from an HTTPS page is
// blocked by the browser as mixed content, and knowledge.station serves both.
const KNOWLEDGE_URL = `${window.location.protocol}//knowledge.station`

export async function getProjectsIndex(): Promise<ProjectsIndex> {
  const res = await fetch(`${KNOWLEDGE_URL}/api/projects/index`)
  if (!res.ok) throw new Error(`Failed to load projects index (${res.status})`)
  return res.json()
}

export async function getProjectDetail(slug: string): Promise<ProjectDetail> {
  const res = await fetch(`${KNOWLEDGE_URL}/api/projects/${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error(`Failed to load project detail (${res.status})`)
  return res.json()
}
