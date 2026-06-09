import type { ServerSetting } from '@shared/types'
import { plexHeaders } from './headers'
import { getServerById } from './servers'

interface RawSetting {
  id: string
  label: string
  summary?: string
  type: string
  group?: string
  value: unknown
  default?: unknown
  hidden?: boolean
  advanced?: boolean
  enumValues?: string
}

/** Parse Plex's "0:Off|1:On" enum descriptor into structured options. */
function parseEnum(s?: string): { value: string; label: string }[] | undefined {
  if (!s) return undefined
  return s.split('|').map((pair) => {
    const idx = pair.indexOf(':')
    return idx === -1
      ? { value: pair, label: pair }
      : { value: pair.slice(0, idx), label: pair.slice(idx + 1) }
  })
}

/** Read all server preferences. Requires an owned (admin) server token. */
export async function getServerPrefs(serverId: string): Promise<ServerSetting[]> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error(`Server ${server.name} is unreachable`)
  if (!server.owned) throw new Error('Server settings are only available to the server owner.')
  const res = await fetch(`${server.bestConnection.uri}/:/prefs`, {
    headers: plexHeaders(server.accessToken)
  })
  if (!res.ok) throw new Error(`Failed to read settings (${res.status})`)
  const data = (await res.json()) as { MediaContainer: { Setting?: RawSetting[] } }
  return (data.MediaContainer.Setting ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    summary: s.summary ?? '',
    type: s.type,
    group: s.group ?? '',
    value: String(s.value ?? ''),
    default: String(s.default ?? ''),
    advanced: !!s.advanced,
    hidden: !!s.hidden,
    enumValues: parseEnum(s.enumValues)
  }))
}

/** Update a single server preference. */
export async function setServerPref(
  serverId: string,
  id: string,
  value: string
): Promise<void> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error(`Server ${server.name} is unreachable`)
  const params = new URLSearchParams({ [id]: value })
  const res = await fetch(`${server.bestConnection.uri}/:/prefs?${params.toString()}`, {
    method: 'PUT',
    headers: plexHeaders(server.accessToken)
  })
  if (!res.ok) throw new Error(`Failed to update ${id} (${res.status})`)
}
