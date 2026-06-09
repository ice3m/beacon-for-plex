import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/** All in-app destinations. A small stack gives us back-navigation for free. */
export type Route =
  | { name: 'home' }
  | { name: 'library'; sectionId: string; title: string }
  | { name: 'playlists' }
  | { name: 'playlist'; ratingKey: string; title: string }
  | { name: 'detail'; ratingKey: string }
  | { name: 'settings' }
  | { name: 'search'; query: string }
  | { name: 'collections'; sectionId: string; title: string }
  | { name: 'allCollections' }
  | { name: 'watchlist' }
  | { name: 'history' }
  | { name: 'collection'; ratingKey: string; title: string }
  | { name: 'person'; personId: string; personName: string; sectionId: string }

interface NavContextValue {
  route: Route
  canGoBack: boolean
  navigate: (route: Route) => void
  /** Replace the current top of the stack (no new history entry). */
  replace: (route: Route) => void
  back: () => void
  reset: (route: Route) => void
}

const NavContext = createContext<NavContextValue | null>(null)

export function NavProvider({ children }: { children: ReactNode }): JSX.Element {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }])

  const navigate = useCallback((route: Route) => setStack((s) => [...s, route]), [])
  const replace = useCallback(
    (route: Route) => setStack((s) => [...s.slice(0, -1), route]),
    []
  )
  const back = useCallback(
    () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    []
  )
  const reset = useCallback((route: Route) => setStack([route]), [])

  const value = useMemo<NavContextValue>(
    () => ({
      route: stack[stack.length - 1],
      canGoBack: stack.length > 1,
      navigate,
      replace,
      back,
      reset
    }),
    [stack, navigate, replace, back, reset]
  )

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used within NavProvider')
  return ctx
}
