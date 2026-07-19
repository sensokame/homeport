import { useState, useEffect } from 'react'
import { NavBar } from '@homeport/ui'
import Overview from './pages/Overview'
import CategoryDetail from './pages/CategoryDetail'
import ProjectPage from './pages/ProjectPage'
import { getProjectsIndex } from './api'
import type { ProjectEntry, ProjectsIndex } from './types'
import styles from './App.module.css'

function getCategoryFromHash(hash: string): string | null {
  const m = hash.match(/^#\/category\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

function getProjectSlugFromHash(hash: string): string | null {
  const m = hash.match(/^#\/project\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function App() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  const [data, setData] = useState<ProjectsIndex | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getProjectsIndex().then(setData).catch(e => setError(e.message))
    const handler = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const activeCategoryName = getCategoryFromHash(hash)
  const activeCategory = data?.categories.find(c => c.name === activeCategoryName) ?? null

  const slugIndex = new Map<string, ProjectEntry>(
    (data?.categories.flatMap(c => c.projects) ?? [])
      .filter((p): p is ProjectEntry & { slug: string } => !!p.slug)
      .map(p => [p.slug, p])
  )
  const activeProjectSlug = getProjectSlugFromHash(hash)
  const activeProject = activeProjectSlug ? slugIndex.get(activeProjectSlug) ?? null : null

  const links = data
    ? [
        { label: 'Overview', href: '#/', active: !activeCategoryName && !activeProjectSlug },
        ...data.categories.map(c => ({
          label: c.name,
          href: `#/category/${encodeURIComponent(c.name)}`,
          active: c.name === activeCategoryName,
        })),
      ]
    : []

  return (
    <div className={styles.root}>
      <NavBar hostname="workspace" links={links} />
      <main className={styles.main}>
        {error
          ? <p className={styles.error}>{error}</p>
          : !data
          ? <p className={styles.muted}>Loading…</p>
          : activeProject
          ? <ProjectPage entry={activeProject} slugIndex={slugIndex} />
          : activeCategory
          ? <CategoryDetail category={activeCategory} />
          : <Overview categories={data.categories} />
        }
      </main>
    </div>
  )
}
