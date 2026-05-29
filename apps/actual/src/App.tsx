import { useState, useEffect } from 'react'
import { NavBar } from '@homeport/ui'
import Overview from './pages/Overview'
import Accounts from './pages/Accounts'
import styles from './App.module.css'

type Tab = 'overview' | 'accounts'

function getTab(hash: string): Tab {
  if (hash === '#/accounts') return 'accounts'
  return 'overview'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(getTab(window.location.hash))

  useEffect(() => {
    const handler = () => setTab(getTab(window.location.hash))
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const links = [
    { label: 'Overview', href: '#/',         active: tab === 'overview' },
    { label: 'Accounts', href: '#/accounts', active: tab === 'accounts' },
  ]

  return (
    <div className={styles.root}>
      <NavBar hostname="Budget" links={links} />
      <main className={styles.main}>
        {tab === 'overview' && <Overview />}
        {tab === 'accounts' && <Accounts />}
      </main>
    </div>
  )
}
