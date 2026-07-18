import { useState, useEffect } from 'react'
import { NavBar } from '@homeport/ui'
import Reading from './pages/Reading'
import Library from './pages/Library'
import Writing from './pages/Writing'
import Life from './pages/Life'
import styles from './App.module.css'

type Section = 'reading' | 'writing' | 'life'
type Shelf = 'currently-reading' | 'read' | 'to-read'

function parseHash(hash: string): { section: Section; shelf: Shelf; writingProject: string | null; writingChapter: string | null } {
  if (hash.startsWith('#/writing')) {
    const [, , project, chapter] = hash.split('/').map(p => (p ? decodeURIComponent(p) : p))
    return { section: 'writing', shelf: 'currently-reading', writingProject: project || null, writingChapter: chapter || null }
  }
  if (hash.startsWith('#/life')) return { section: 'life', shelf: 'currently-reading', writingProject: null, writingChapter: null }
  if (hash === '#/read') return { section: 'reading', shelf: 'read', writingProject: null, writingChapter: null }
  if (hash === '#/to-read') return { section: 'reading', shelf: 'to-read', writingProject: null, writingChapter: null }
  return { section: 'reading', shelf: 'currently-reading', writingProject: null, writingChapter: null }
}

export default function App() {
  const [{ section, shelf, writingProject, writingChapter }, setRoute] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const sectionLinks = [
    { label: 'Reading', href: '#/', active: section === 'reading' },
    { label: 'Writing', href: '#/writing', active: section === 'writing' },
    { label: 'Life', href: '#/life', active: section === 'life' },
  ]

  const shelfTabs: { label: string; href: string; value: Shelf }[] = [
    { label: 'Currently reading', href: '#/', value: 'currently-reading' },
    { label: 'Read', href: '#/read', value: 'read' },
    { label: 'To read', href: '#/to-read', value: 'to-read' },
  ]

  return (
    <div className={styles.root}>
      <NavBar hostname="knowledge" links={sectionLinks} />
      {section === 'reading' && (
        <div className={styles.shelfNav}>
          {shelfTabs.map(t => (
            <a
              key={t.value}
              href={t.href}
              className={[styles.shelfTab, shelf === t.value ? styles.shelfTabActive : ''].filter(Boolean).join(' ')}
            >
              {t.label}
            </a>
          ))}
          <a
            className={styles.quartzBtn}
            href="http://quartz.station"
            target="_blank"
            rel="noopener"
          >
            Open Quartz →
          </a>
        </div>
      )}
      {section === 'life' && (
        <div className={styles.shelfNav}>
          <a href="#/life" className={[styles.shelfTab, styles.shelfTabActive].join(' ')}>
            Overview
          </a>
          <a
            className={styles.quartzBtn}
            href="http://quartz.station"
            target="_blank"
            rel="noopener"
          >
            Open Quartz →
          </a>
        </div>
      )}
      <main className={styles.main}>
        {section === 'reading' && shelf === 'currently-reading' && <Reading />}
        {section === 'reading' && shelf === 'read' && <Library shelf="read" />}
        {section === 'reading' && shelf === 'to-read' && <Library shelf="to-read" />}
        {section === 'writing' && <Writing initialProject={writingProject} initialChapter={writingChapter} />}
        {section === 'life' && <Life />}
      </main>
    </div>
  )
}
