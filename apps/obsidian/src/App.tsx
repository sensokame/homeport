import { useState, useEffect } from 'react'
import { NavBar } from '@homeport/ui'
import Reading from './pages/Reading'
import Library from './pages/Library'
import styles from './App.module.css'

type Section = 'reading'
type Shelf = 'currently-reading' | 'read' | 'to-read'

function parseHash(hash: string): { section: Section; shelf: Shelf } {
  if (hash === '#/read') return { section: 'reading', shelf: 'read' }
  if (hash === '#/to-read') return { section: 'reading', shelf: 'to-read' }
  return { section: 'reading', shelf: 'currently-reading' }
}

export default function App() {
  const [{ section, shelf }, setRoute] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const sectionLinks = [
    { label: 'Reading', href: '#/', active: section === 'reading' },
  ]

  const shelfTabs: { label: string; href: string; value: Shelf }[] = [
    { label: 'Currently reading', href: '#/', value: 'currently-reading' },
    { label: 'Read', href: '#/read', value: 'read' },
    { label: 'To read', href: '#/to-read', value: 'to-read' },
  ]

  return (
    <div className={styles.root}>
      <NavBar hostname="knowledge" links={sectionLinks} />
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
      <main className={styles.main}>
        {shelf === 'currently-reading' && <Reading />}
        {shelf === 'read' && <Library shelf="read" />}
        {shelf === 'to-read' && <Library shelf="to-read" />}
      </main>
    </div>
  )
}
