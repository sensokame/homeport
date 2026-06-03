import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import styles from './SwipeableCard.module.css'

export interface SwipeableCardProps {
  home: ReactNode
  pages?: ReactNode[]
}

const SWIPE_THRESHOLD = 50

export function SwipeableCard({ home, pages = [] }: SwipeableCardProps) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const panels = [home, ...pages]
  const total = panels.length

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (delta < -SWIPE_THRESHOLD && index < total - 1) setIndex(i => i + 1)
    else if (delta > SWIPE_THRESHOLD && index > 0) setIndex(i => i - 1)
  }

  return (
    <div className={styles.root}>
      <div
        className={styles.trackClip}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className={styles.track}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {panels.map((panel, i) => (
            <div key={i} className={styles.panel}>{panel}</div>
          ))}
        </div>
      </div>
      {total > 1 && (
        <div className={styles.nav}>
          <div className={styles.navSide}>
            {index > 0 && (
              <button className={styles.homeBtn} onClick={() => setIndex(0)} aria-label="Go to home">
                ← home
              </button>
            )}
          </div>
          <div className={styles.dotsRow}>
            <button
              className={styles.arrowBtn}
              onClick={() => setIndex(i => i - 1)}
              disabled={index === 0}
              aria-label="Previous"
            >
              ‹
            </button>
            <div className={styles.dots}>
              {panels.map((_, i) => (
                <button
                  key={i}
                  className={[styles.dot, i === index ? styles.dotActive : ''].filter(Boolean).join(' ')}
                  onClick={() => setIndex(i)}
                  aria-label={i === 0 ? 'Home' : `Page ${i}`}
                />
              ))}
            </div>
            <button
              className={styles.arrowBtn}
              onClick={() => setIndex(i => i + 1)}
              disabled={index === total - 1}
              aria-label="Next"
            >
              ›
            </button>
          </div>
          <div className={styles.navSide} />
        </div>
      )}
    </div>
  )
}
