import { useEffect, useState } from 'react'

/**
 * Small client-side UI preferences kept in localStorage. Changes broadcast a
 * window event so any mounted component updates live.
 */
const EVENT = 'appprefs-changed'
const HERO_KEY = 'plex-show-hero'

export function getShowHero(): boolean {
  return localStorage.getItem(HERO_KEY) !== '0' // default on
}

export function setShowHero(value: boolean): void {
  localStorage.setItem(HERO_KEY, value ? '1' : '0')
  window.dispatchEvent(new Event(EVENT))
}

/** Reactive read of the "show Featured banner" preference. */
export function useShowHero(): boolean {
  const [v, setV] = useState(getShowHero)
  useEffect(() => {
    const handler = (): void => setV(getShowHero())
    window.addEventListener(EVENT, handler)
    return () => window.removeEventListener(EVENT, handler)
  }, [])
  return v
}
