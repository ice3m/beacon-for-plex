import type { PlexHomeUser } from '@shared/types'
import { getToken } from '../store'
import { plexHeaders } from './headers'

/** List the account's Plex Home (managed) users via plex.tv. */
export async function listHomeUsers(): Promise<PlexHomeUser[]> {
  const token = getToken()
  if (!token) throw new Error('Not logged in')
  const res = await fetch('https://plex.tv/api/v2/home/users', { headers: plexHeaders(token) })
  if (!res.ok) throw new Error(`Failed to list home users (${res.status})`)
  const data = (await res.json()) as { users?: Record<string, unknown>[] } | Record<string, unknown>[]
  const arr = Array.isArray(data) ? data : (data.users ?? [])
  return arr.map((u) => ({
    id: Number(u.id),
    uuid: String(u.uuid ?? ''),
    title: String(u.title ?? u.username ?? u.friendlyName ?? 'User'),
    thumb: (u.thumb as string) ?? null,
    admin: u.admin === true,
    restricted: u.restricted === true,
    protected: u.protected === true || u.hasPassword === true
  }))
}

/**
 * Obtain an access token for a Home user by switching to their profile
 * (admin-only). PIN required for protected users.
 */
export async function getUserToken(userUuid: string, pin?: string): Promise<string> {
  const token = getToken()
  if (!token) throw new Error('Not logged in')
  const params = new URLSearchParams()
  if (pin) params.set('pin', pin)
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`https://plex.tv/api/v2/home/users/${userUuid}/switch${qs}`, {
    method: 'POST',
    headers: plexHeaders(token)
  })
  if (res.status === 401 || res.status === 403) {
    throw new Error('That user needs a PIN to switch to.')
  }
  if (!res.ok) throw new Error(`Failed to switch user (${res.status})`)
  const data = (await res.json()) as { authToken?: string; authentication?: { token?: string } }
  const userToken = data.authToken ?? data.authentication?.token
  if (!userToken) throw new Error('No token returned for that user')
  return userToken
}
