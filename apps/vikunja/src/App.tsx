import { useState, useEffect } from 'react'
import { NavBar } from '@homeport/ui'
import Today from './pages/Today'
import Projects from './pages/Projects'
import styles from './App.module.css'

type Tab = 'today' | 'projects'

function getTab(hash: string): Tab {
  if (hash === '#/projects') return 'projects'
  return 'today'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(getTab(window.location.hash))

  useEffect(() => {
    const handler = () => setTab(getTab(window.location.hash))
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const links = [
    { label: 'Today',    href: '#/',         active: tab === 'today' },
    { label: 'Projects', href: '#/projects', active: tab === 'projects' },
  ]

  return (
    <div className={styles.root}>
      <NavBar hostname="Tasks" links={links} />
      <main className={styles.main}>
        {tab === 'today'    && <Today />}
        {tab === 'projects' && <Projects />}
      </main>
    </div>
  )
}
