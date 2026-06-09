import type { PinSession, PlexAccount } from '@shared/types'
import { getClientIdentifier, getLastAccount, getToken, setLastAccount, setToken } from '../store'
import { PLEX_PRODUCT, plexHeaders } from './headers'

const PLEX_TV = 'https://plex.tv'

/**
 * Step 1 of the PIN flow: request a short-lived PIN. The user authorizes it by
 * opening `authUrl` in a browser and signing in to plex.tv.
 * Docs: https://forums.plex.tv/t/authenticating-with-plex/609370
 */
export async function startLogin(): Promise<PinSession> {
  const res = await fetch(`${PLEX_TV}/api/v2/pins?strong=true`, {
    method: 'POST',
    headers: plexHeaders()
  })
  if (!res.ok) throw new Error(`Failed to create PIN (${res.status})`)
  const pin = (await res.json()) as { id: number; code: string }

  const params = new URLSearchParams({
    clientID: getClientIdentifier(),
    code: pin.code,
    'context[device][product]': PLEX_PRODUCT
  })
  const authUrl = `https://app.plex.tv/auth#?${params.toString()}`
  return { id: pin.id, code: pin.code, authUrl }
}

/**
 * Step 2: poll the PIN until plex.tv attaches an authToken (user authorized) or
 * we hit the timeout. On success the token is persisted and the account
 * returned.
 */
export async function waitForLogin(
  pinId: number,
  { timeoutMs = 300_000, intervalMs = 2_000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<PlexAccount> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(`${PLEX_TV}/api/v2/pins/${pinId}`, {
      headers: plexHeaders()
    })
    if (res.ok) {
      const pin = (await res.json()) as { authToken: string | null }
      if (pin.authToken) {
        setToken(pin.authToken)
        const acct = await fetchAccount(pin.authToken)
        setLastAccount(acct)
        return acct
      }
    }
    await delay(intervalMs)
  }
  throw new Error('Login timed out. Please try again.')
}

/** Fetch the signed-in user's profile. */
export async function fetchAccount(token: string): Promise<PlexAccount> {
  const res = await fetch(`${PLEX_TV}/api/v2/user`, { headers: plexHeaders(token) })
  if (!res.ok) throw new Error(`Failed to load account (${res.status})`)
  const user = (await res.json()) as {
    id: number
    uuid: string
    username: string
    title: string
    email: string
    thumb: string | null
  }
  return {
    id: user.id,
    uuid: user.uuid,
    username: user.username,
    title: user.title,
    email: user.email,
    thumb: user.thumb ?? null
  }
}

/** Returns the current account if we hold a valid token, else null. */
export async function getCurrentAccount(): Promise<PlexAccount | null> {
  const token = getToken()
  if (!token) return null
  try {
    const acct = await fetchAccount(token)
    setLastAccount(acct)
    console.log('[auth] getCurrentAccount: restored session for', acct.username)
    return acct
  } catch (err) {
    // A valid token but a failed account check (network/plex.tv hiccup) should
    // NOT log the user out — fall back to the last known account.
    const cached = getLastAccount()
    console.error(
      '[auth] getCurrentAccount: fetchAccount failed:',
      (err as Error).message,
      cached ? '(using cached account)' : '(no cached account)'
    )
    return cached
  }
}

export function logout(): void {
  setToken(null)
  setLastAccount(null)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
