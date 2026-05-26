import styles from './NavBar.module.css'

interface NavLink {
  label: string
  href: string
  active?: boolean
}

interface NavBarProps {
  hostname: string
  links?: NavLink[]
}

export function NavBar({ hostname, links = [] }: NavBarProps) {
  return (
    <header className={styles.navbar}>
      <span className={styles.hostname}>{hostname}</span>
      {links.length > 0 && (
        <nav className={styles.nav}>
          {links.map(l => (
            <a
              key={l.href}
              href={l.href}
              className={[styles.link, l.active ? styles.active : ''].filter(Boolean).join(' ')}
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}
