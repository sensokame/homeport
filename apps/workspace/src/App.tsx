import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.root}>
      <p className={styles.text}>
        workspace-sat has no standalone page — its only job is composing other
        satellites' widgets into the hub dashboard via the <code>workspace.panel</code> widget.
      </p>
    </div>
  )
}
