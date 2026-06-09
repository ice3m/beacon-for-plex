import { useState } from 'react'
import type { PlexRole } from '@shared/types'
import { imageUrl } from '@shared/ipc'
import { useNav } from '../state/nav'

interface Props {
  serverId: string
  roles: PlexRole[]
  /** When set, cast members link to their filmography in this section. */
  sectionId?: string
}

/** Resolve a headshot: absolute agent URLs as-is, server paths via plex-img. */
function personImage(serverId: string, thumb?: string): string | undefined {
  if (!thumb) return undefined
  if (thumb.startsWith('http')) return thumb
  return imageUrl(serverId, thumb, { width: 300, height: 300 })
}

/** Horizontal "Cast & Crew" row of circular avatars, like the Plex app. */
export function CastRow({ serverId, roles, sectionId }: Props): JSX.Element | null {
  if (roles.length === 0) return null
  return (
    <section className="mt-10 px-8 pb-4">
      <h2 className="mb-4 text-xl font-semibold">Cast &amp; Crew</h2>
      <div className="flex gap-5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {roles.map((role) => (
          <CastMember key={role.id} serverId={serverId} role={role} sectionId={sectionId} />
        ))}
      </div>
    </section>
  )
}

function CastMember({
  serverId,
  role,
  sectionId
}: {
  serverId: string
  role: PlexRole
  sectionId?: string
}): JSX.Element {
  const { navigate } = useNav()
  const [failed, setFailed] = useState(false)
  const src = personImage(serverId, role.thumb)
  const initials = role.tag
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
  // Clickable only when we know which section to search for the person.
  const clickable = !!sectionId && !!role.id
  const open = (): void => {
    if (clickable)
      navigate({ name: 'person', personId: role.id, personName: role.tag, sectionId: sectionId! })
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={!clickable}
      className={`group flex w-28 shrink-0 flex-col items-center text-center ${
        clickable ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <div
        className={`mb-2 h-24 w-24 overflow-hidden rounded-full bg-surface-raised ring-1 ring-white/10 transition ${
          clickable ? 'group-hover:ring-2 group-hover:ring-accent' : ''
        }`}
      >
        {src && !failed ? (
          <img
            src={src}
            alt={role.tag}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-ink-muted">
            {initials || '👤'}
          </div>
        )}
      </div>
      <p className="w-full truncate text-sm font-medium text-ink" title={role.tag}>
        {role.tag}
      </p>
      {role.role && (
        <p className="w-full truncate text-xs text-ink-muted" title={role.role}>
          {role.role}
        </p>
      )}
    </button>
  )
}
