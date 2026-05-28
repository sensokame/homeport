import { useState, useEffect } from 'react'
import { NavBar } from '@homeport/ui'
import Today from './pages/Today'
import Plan from './pages/Plan'
import Nutrition from './pages/Nutrition'
import styles from './App.module.css'

type Tab = 'today' | 'plan' | 'nutrition'

function getTab(hash: string): Tab {
  if (hash === '#/plan') return 'plan'
  if (hash === '#/nutrition') return 'nutrition'
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
    { label: 'Today',     href: '#/',          active: tab === 'today' },
    { label: 'Plan',      href: '#/plan',      active: tab === 'plan' },
    { label: 'Nutrition', href: '#/nutrition', active: tab === 'nutrition' },
  ]

  return (
    <div className={styles.root}>
      <NavBar hostname="Fitness" links={links} />
      <main className={styles.main}>
        {tab === 'today'     && <Today />}
        {tab === 'plan'      && <Plan />}
        {tab === 'nutrition' && <Nutrition />}
      </main>
    </div>
  )
}
