import { useEffect, useRef, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Icon } from './icons'
import { useNav } from '../state/nav'
import { HomeView } from '../views/HomeView'
import { LibraryView } from '../views/LibraryView'
import { DetailView } from '../views/DetailView'
import { PlaylistsView } from '../views/PlaylistsView'
import { PlaylistView } from '../views/PlaylistView'
import { SettingsView } from '../views/SettingsView'
import { SearchView } from '../views/SearchView'
import { CollectionsView } from '../views/CollectionsView'
import { AllCollectionsView } from '../views/AllCollectionsView'
import { CollectionView } from '../views/CollectionView'
import { WatchlistView } from '../views/WatchlistView'
import { HistoryView } from '../views/HistoryView'
import { CommandPalette } from './CommandPalette'
import { PersonView } from '../views/PersonView'

interface Props {
  serverId: string
  serverName: string
  owned: boolean
  onSwitchServer: () => void
}

/** Authenticated app layout: sidebar + a top bar (back + search) + content. */
const SIDEBAR_KEY = 'plex-sidebar-collapsed'

export function Shell({ serverId, serverName, owned, onSwitchServer }: Props): JSX.Element {
  const { route, canGoBack, back } = useNav()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const [paletteOpen, setPaletteOpen] = useState(false)

  const toggleSidebar = (): void => {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      return next
    })
  }

  // Ctrl/⌘+K opens the command palette anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full min-h-0">
      {!collapsed && (
        <Sidebar serverId={serverId} serverName={serverName} onSwitchServer={onSwitchServer} />
      )}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/5 px-4">
          <button
            onClick={toggleSidebar}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition hover:bg-white/10 hover:text-ink"
            aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <button
            onClick={back}
            disabled={!canGoBack}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition enabled:hover:bg-white/10 enabled:hover:text-ink disabled:opacity-30"
            aria-label="Back"
          >
            <Icon name="chevronLeft" className="h-5 w-5" />
          </button>
          <SearchBar serverId={serverId} />
          <button
            onClick={() => setPaletteOpen(true)}
            title="Quick jump (Ctrl/⌘ + K)"
            aria-label="Open command palette"
            className="hidden items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-ink-muted transition hover:bg-white/5 hover:text-ink sm:flex"
          >
            <Icon name="search" className="h-3.5 w-3.5" />
            <kbd className="font-sans">⌘K</kbd>
          </button>
        </div>

        {paletteOpen && (
          <CommandPalette serverId={serverId} onClose={() => setPaletteOpen(false)} />
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {route.name === 'library' ? (
            <Content serverId={serverId} owned={owned} key={routeKey(route)} />
          ) : (
            <div className="h-full overflow-y-auto">
              <Content serverId={serverId} owned={owned} key={routeKey(route)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SearchBar({ serverId }: { serverId: string }): JSX.Element {
  const { route, navigate, replace, back } = useNav()
  const [text, setText] = useState(route.name === 'search' ? route.query : '')
  const routeRef = useRef(route)
  routeRef.current = route

  useEffect(() => {
    const t = setTimeout(() => {
      const q = text.trim()
      const onSearch = routeRef.current.name === 'search'
      if (q.length >= 2) {
        if (onSearch) replace({ name: 'search', query: q })
        else navigate({ name: 'search', query: q })
      } else if (q.length === 0 && onSearch) {
        back()
      }
    }, 300)
    return () => clearTimeout(t)
  }, [text, navigate, replace, back])

  return (
    <div className="relative max-w-md flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
        <Icon name="search" className="h-4 w-4" />
      </span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search movies, shows, episodes…"
        className="w-full rounded-full border border-white/10 bg-surface-raised py-2 pl-9 pr-9 text-sm outline-none transition focus:border-accent"
      />
      {text && (
        <button
          onClick={() => setText('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  )
}

/**
 * Stable remount key per destination so scroll/state resets when you navigate
 * to a *different* item — but NOT on every field change. Notably excludes the
 * search query so typing doesn't fully remount SearchView each keystroke
 * (SearchView reacts to the query prop internally).
 */
function routeKey(route: ReturnType<typeof useNav>['route']): string {
  switch (route.name) {
    case 'library':
    case 'collections':
      return `${route.name}:${route.sectionId}`
    case 'detail':
    case 'collection':
    case 'playlist':
      return `${route.name}:${route.ratingKey}`
    case 'person':
      return `person:${route.personId}`
    default:
      return route.name
  }
}

function Content({ serverId, owned }: { serverId: string; owned: boolean }): JSX.Element {
  const { route } = useNav()
  switch (route.name) {
    case 'home':
      return <HomeView serverId={serverId} />
    case 'library':
      return <LibraryView serverId={serverId} sectionId={route.sectionId} title={route.title} />
    case 'detail':
      return <DetailView serverId={serverId} ratingKey={route.ratingKey} />
    case 'playlists':
      return <PlaylistsView serverId={serverId} />
    case 'playlist':
      return <PlaylistView serverId={serverId} ratingKey={route.ratingKey} title={route.title} />
    case 'settings':
      return <SettingsView serverId={serverId} owned={owned} />
    case 'search':
      return <SearchView serverId={serverId} query={route.query} />
    case 'collections':
      return <CollectionsView serverId={serverId} sectionId={route.sectionId} title={route.title} />
    case 'allCollections':
      return <AllCollectionsView serverId={serverId} />
    case 'watchlist':
      return <WatchlistView serverId={serverId} />
    case 'history':
      return <HistoryView serverId={serverId} />
    case 'collection':
      return <CollectionView serverId={serverId} ratingKey={route.ratingKey} title={route.title} />
    case 'person':
      return (
        <PersonView
          serverId={serverId}
          personId={route.personId}
          name={route.personName}
          sectionId={route.sectionId}
        />
      )
  }
}
