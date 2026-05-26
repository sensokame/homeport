import { useState, useEffect } from 'react'
import { NavBar } from '@homeport/ui'
import Inventory from './pages/Inventory'
import Projects from './pages/Projects'
import ShoppingList from './pages/ShoppingList'
import styles from './App.module.css'

type Tab = 'inventory' | 'projects' | 'shopping'

function getTab(hash: string): Tab {
  if (hash === '#/projects') return 'projects'
  if (hash === '#/shopping-list') return 'shopping'
  return 'inventory'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(getTab(window.location.hash))

  useEffect(() => {
    const handler = () => setTab(getTab(window.location.hash))
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const links = [
    { label: 'Inventory',     href: '#/',             active: tab === 'inventory' },
    { label: 'Projects',      href: '#/projects',     active: tab === 'projects' },
    { label: 'Shopping List', href: '#/shopping-list', active: tab === 'shopping' },
  ]

  return (
    <div className={styles.root}>
      <NavBar hostname="Inventory" links={links} />
      <main className={styles.main}>
        {tab === 'inventory' && <Inventory />}
        {tab === 'projects'  && <Projects />}
        {tab === 'shopping'  && <ShoppingList />}
      </main>
    </div>
  )
}
