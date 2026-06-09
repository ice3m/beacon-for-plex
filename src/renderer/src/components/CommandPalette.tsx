import { useEffect, useMemo, useRef, useState } from 'react'
import { useSections, usePlaylists } from '../lib/hooks'
import { useNav } from '../state/nav'
import type { Route } from '../state/nav'
import { Icon } from './icons'

interface Command {
  id: string
  label: string
  group: string
  icon: string
  route: Route
}

/**
 * Ctrl/⌘+K quick switcher: fuzzy-jump to any page, library, or playlist.
 */
export function CommandPalette({
  serverId,
  onClose
}: {
  serverId: string
  onClose: () => void
}): JSX.Element {
  const { navigate, reset } = useNav()
  const { data: sections } = useSections(serverId)
  const { data: playlists } = usePlaylists(serverId)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = [
      { id: 'home', label: 'Home', group: 'Go to', icon: 'home', route: { name: 'home' } },
      { id: 'watchlist', label: 'My List', group: 'Go to', icon: 'bookmark', route: { name: 'watchlist' } },
      { id: 'history', label: 'Recently Watched', group: 'Go to', icon: 'clock', route: { name: 'history' } },
      { id: 'playlists', label: 'Playlists', group: 'Go to', icon: 'playlists', route: { name: 'playlists' } },
      { id: 'collections', label: 'Collections', group: 'Go to', icon: 'collections', route: { name: 'allCollections' } },
      { id: 'settings', label: 'Settings', group: 'Go to', icon: 'settings', route: { name: 'settings' } }
    ]
    const libs: Command[] = (sections ?? [])
      .filter((s) => !s.hidden)
      .map((s) => ({
        id: `lib-${s.key}`,
        label: s.title,
        group: 'Libraries',
        icon: 'folder',
        route: { name: 'library', sectionId: s.key, title: s.title }
      }))
    const pls: Command[] = (playlists ?? [])
      .filter((p) => !p.smart)
      .map((p) => ({
        id: `pl-${p.ratingKey}`,
        label: p.title,
        group: 'Playlists',
        icon: 'playlists',
        route: { name: 'playlist', ratingKey: p.ratingKey, title: p.title }
      }))
    return [...pages, ...libs, ...pls]
  }, [sections, playlists])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, query])

  // Keep the active index in range as the filtered list shrinks.
  useEffect(() => setActive(0), [query])

  const run = (cmd: Command | undefined): void => {
    if (!cmd) return
    if (cmd.route.name === 'home') reset(cmd.route)
    else navigate(cmd.route)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(filtered[active])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  // Scroll the active row into view.
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-surface-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <Icon name="search" className="h-4 w-4 text-ink-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page, library, or playlist…"
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-ink-muted"
          />
          <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-ink-muted">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">No matches.</p>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              data-idx={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(cmd)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                i === active ? 'bg-accent/20 text-ink' : 'text-ink-muted hover:bg-white/5'
              }`}
            >
              <span className="flex w-5 shrink-0 justify-center">
                <Icon name={cmd.icon} className="h-4 w-4" />
              </span>
              <span className="flex-1 truncate text-ink">{cmd.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-ink-muted">{cmd.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
