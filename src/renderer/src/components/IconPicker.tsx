import { useState } from 'react'
import type { PlexLibrarySection } from '@shared/types'
import { useSetLibraryIcon } from '../lib/hooks'
import { Icon, LIBRARY_ICON_CHOICES } from './icons'

interface Props {
  serverId: string
  section: PlexLibrarySection
  onClose: () => void
}

/** Modal for assigning a local custom (flat) icon to a library. */
export function IconPicker({ serverId, section, onClose }: Props): JSX.Element {
  const setIcon = useSetLibraryIcon(serverId)
  const [custom, setCustom] = useState('')

  const apply = (icon: string | null): void => {
    setIcon.mutate({ sectionId: section.key, icon }, { onSuccess: onClose })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-raised p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Icon for “{section.title}”</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink">
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-ink-muted">
          Flat icons match the Plex style and recolor with your theme. Stored locally.
        </p>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {LIBRARY_ICON_CHOICES.map((choice) => (
            <button
              key={choice.id}
              onClick={() => apply(choice.id)}
              title={choice.label}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-white/5 transition hover:bg-accent/20 ${
                section.customIcon === choice.id ? 'ring-2 ring-accent text-accent' : 'text-ink'
              }`}
            >
              <Icon name={choice.id} className="h-6 w-6" />
              <span className="px-1 text-[9px] leading-tight text-ink-muted">{choice.label}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={4}
            placeholder="…or type any emoji"
            className="flex-1 rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={() => custom && apply(custom)}
            disabled={!custom}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Set
          </button>
        </div>

        <button
          onClick={() => apply(null)}
          className="w-full rounded-lg border border-white/10 py-2 text-sm text-ink-muted transition hover:bg-white/5"
        >
          Reset to default
        </button>
      </div>
    </div>
  )
}
