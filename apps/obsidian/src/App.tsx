import { useState, useEffect } from 'react'
import { NavBar } from '@homeport/ui'
import Reading from './pages/Reading'
import Library from './pages/Library'
import styles from './App.module.css'

type Page = 'reading' | 'read' | 'to-read'

export default function App() {
  const [page, setPage] = useState<Page>('reading')

  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash
      if (hash === '#/read') setPage('read')
      else if (hash === '#/to-read') setPage('to-read')
      else setPage('reading')
    }
    handler()
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const links = [
    { label: 'Reading', href: '#/', active: page === 'reading' },
    { label: 'Read', href: '#/read', active: page === 'read' },
    { label: 'To Read', href: '#/to-read', active: page === 'to-read' },
  ]

  return (
    <div className={styles.root}>
      <NavBar hostname="knowledge" links={links} />
      <main className={styles.main}>
        {page === 'reading' && <Reading />}
        {page === 'read' && <Library shelf="read" />}
        {page === 'to-read' && <Library shelf="to-read" />}
      </main>
    </div>
  )
}
