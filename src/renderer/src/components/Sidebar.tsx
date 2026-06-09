import { useState } from 'react'
import type { ReactNode } from 'react'
import { useSections, useSetLibraryOrder } from '../lib/hooks'
import { useNav } from '../state/nav'
import { Icon, LibraryGlyph } from './icons'

interface Props {
  serverId: string
  serverName: string
  onSwitchServer: () => void
}

/** Move `fromId` to just before `toId` within the full ordered id list. */
function reorder(ids: string[], fromId: string, toId: string): string[] {
  const without = ids.filter((id) => id !== fromId)
  const idx = without.indexOf(toId)
  if (idx === -1) return ids
  without.splice(idx, 0, fromId)
  return without
}

export function Sidebar({ serverId, serverName, onSwitchServer }: Props): JSX.Element {
  const { data: sections, isLoading } = useSections(serverId)
  const setOrder = useSetLibraryOrder(serverId)
  const { route, navigate, reset } = useNav()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const activeSection = route.name === 'library' ? route.sectionId : null
  const visible = sections?.filter((s) => !s.hidden)

  const commitDrop = (toId: string): void => {
    // Ignore drops while a previous reorder is still in flight (avoid racing writes).
    if (dragId && dragId !== toId && sections && !setOrder.isPending) {
      setOrder.mutate(reorder(sections.map((s) => s.key), dragId, toId))
    }
    setDragId(null)
    setOverId(null)
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/5 bg-surface-raised/40">
      <nav className="flex-1 overflow-y-auto p-3">
        <NavItem
          label="Home"
          icon={<Icon name="home" />}
          active={route.name === 'home'}
          onClick={() => reset({ name: 'home' })}
        />
        <NavItem
          label="My List"
          icon={<Icon name="bookmark" />}
          active={route.name === 'watchlist'}
          onClick={() => navigate({ name: 'watchlist' })}
        />
        <NavItem
          label="Recently Watched"
          icon={<Icon name="clock" />}
          active={route.name === 'history'}
          onClick={() => navigate({ name: 'history' })}
        />
        <NavItem
          label="Playlists"
          icon={<Icon name="playlists" />}
          active={route.name === 'playlists' || route.name === 'playlist'}
          onClick={() => navigate({ name: 'playlists' })}
        />
        <NavItem
          label="Collections"
          icon={<Icon name="collections" />}
          active={route.name === 'allCollections'}
          onClick={() => navigate({ name: 'allCollections' })}
        />

        <p className="mb-1 mt-5 px-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Libraries
        </p>

        {isLoading && <p className="px-3 py-2 text-sm text-ink-muted">Loading…</p>}

        {visible?.map((section) => (
          <div
            key={section.key}
            draggable
            onDragStart={() => setDragId(section.key)}
            onDragOver={(e) => {
              e.preventDefault()
              if (overId !== section.key) setOverId(section.key)
            }}
            onDrop={() => commitDrop(section.key)}
            onDragEnd={() => {
              setDragId(null)
              setOverId(null)
            }}
            className={`group/lib relative rounded-lg transition ${
              dragId === section.key ? 'opacity-40' : ''
            } ${overId === section.key && dragId !== section.key ? 'ring-1 ring-accent' : ''}`}
          >
            <NavItem
              label={section.title}
              icon={<LibraryGlyph iconId={section.customIcon} type={section.type} />}
              active={activeSection === section.key}
              onClick={() =>
                navigate({ name: 'library', sectionId: section.key, title: section.title })
              }
            />
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-3">
        <NavItem
          label="Settings"
          icon={<Icon name="settings" />}
          active={route.name === 'settings'}
          onClick={() => navigate({ name: 'settings' })}
        />
        <button
          onClick={onSwitchServer}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition hover:bg-white/5"
          title="Switch server"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="truncate">{serverName}</span>
        </button>
      </div>
    </aside>
  )
}

function NavItem({
  label,
  icon,
  active,
  onClick
}: {
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
        active ? 'bg-accent/20 text-ink' : 'text-ink-muted hover:bg-white/5 hover:text-ink'
      }`}
    >
      <span className="flex w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}
