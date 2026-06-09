import type { SyncedPlaylist } from '@shared/types'
import {
  getHomeUserToken,
  getSyncedPlaylists,
  removeSyncGroup,
  saveSyncGroup,
  type SyncedPlaylistGroup
} from '../store'
import { plexHeaders } from './headers'
import { getServerById } from './servers'

/**
 * Two-way sync for playlists shared with Plex Home users.
 *
 * Plex has no native collaborative playlists, so we reconcile membership
 * ourselves with a three-way merge against a stored baseline (the item set at
 * the last successful sync):
 *
 *   adds    = ∪ over sides of (current_i \ baseline)
 *   removes = ∪ over sides of (baseline \ current_i)
 *   target  = (baseline ∪ adds) \ removes
 *
 * An add on any side propagates everywhere; a remove on any side wins. Each
 * side is then converged to `target` and the baseline advances to it.
 */

interface SideItem {
  ratingKey: string
  playlistItemID: string
}

interface Side {
  /** 'admin' or a member uuid — for diagnostics only. */
  label: string
  token: string
  ratingKey: string
  /** Ordered current items (ratingKey + playlistItemID). */
  items: SideItem[]
  keys: Set<string>
  /**
   * Whether this side's contents feed the merge (adds/removes). A member that
   * was unreadable last round (expired token) is converged TO the target this
   * round WITHOUT contributing, so items removed while it was offline don't
   * resurface. It still gets reconciled — it just adopts the shared state.
   */
  contributes: boolean
}

/** Resolve a server's base URI + machine id, or throw if unreachable. */
async function serverBase(serverId: string): Promise<{ uri: string; machineId: string; adminToken: string }> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error(`Server ${server.name} is unreachable`)
  return { uri: server.bestConnection.uri, machineId: server.clientIdentifier, adminToken: server.accessToken }
}

/** Read a playlist's items (ordered) using a specific token. */
async function readItems(uri: string, ratingKey: string, token: string): Promise<SideItem[]> {
  const res = await fetch(`${uri}/playlists/${ratingKey}/items`, { headers: plexHeaders(token) })
  if (!res.ok) throw new Error(`read items failed (${res.status})`)
  const data = (await res.json()) as {
    MediaContainer?: { Metadata?: Record<string, unknown>[] }
  }
  return (data.MediaContainer?.Metadata ?? []).map((m) => ({
    ratingKey: String(m.ratingKey),
    playlistItemID: String(m.playlistItemID ?? '')
  }))
}

/** Append items (by ratingKey) to a playlist using a specific token. */
async function addItems(
  ctx: { uri: string; machineId: string },
  ratingKey: string,
  token: string,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return
  const itemUri = `server://${ctx.machineId}/com.plexapp.plugins.library/library/metadata/${keys.join(',')}`
  const params = new URLSearchParams({ uri: itemUri })
  const res = await fetch(`${ctx.uri}/playlists/${ratingKey}/items?${params.toString()}`, {
    method: 'PUT',
    headers: plexHeaders(token)
  })
  if (!res.ok) throw new Error(`add items failed (${res.status})`)
}

/** Remove items (by playlistItemID) from a playlist using a specific token. */
async function removeItems(
  uri: string,
  ratingKey: string,
  token: string,
  playlistItemIDs: string[]
): Promise<void> {
  for (const id of playlistItemIDs) {
    if (!id) continue
    await fetch(`${uri}/playlists/${ratingKey}/items/${id}`, {
      method: 'DELETE',
      headers: plexHeaders(token)
    }).catch(() => {})
  }
}

/** Build the stable target order: admin order, then baseline, then new adds. */
function orderTarget(
  target: Set<string>,
  adminOrder: string[],
  baseline: string[],
  memberOrders: string[][]
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (k: string): void => {
    if (target.has(k) && !seen.has(k)) {
      seen.add(k)
      out.push(k)
    }
  }
  adminOrder.forEach(push)
  baseline.forEach(push)
  for (const order of memberOrders) order.forEach(push)
  return out
}

/**
 * Reconcile a single group: read every readable side, three-way merge, push
 * adds/removes to each side, advance the baseline. Returns the updated group.
 */
export async function syncGroup(group: SyncedPlaylistGroup): Promise<SyncedPlaylistGroup> {
  const next: SyncedPlaylistGroup = { ...group, members: group.members.map((m) => ({ ...m })) }
  try {
    const ctx = await serverBase(group.serverId)

    // --- Read all sides we can (admin + each member with a valid token) ---
    const sides: Side[] = []

    let adminItems: SideItem[]
    try {
      adminItems = await readItems(ctx.uri, group.adminRatingKey, ctx.adminToken)
    } catch (err) {
      // Source playlist deleted (404) → stop syncing this group entirely.
      if (err instanceof Error && err.message.includes('(404)')) {
        removeSyncGroup(group.serverId, group.adminRatingKey)
        return { ...next, lastError: 'Source playlist deleted — sync removed' }
      }
      throw err
    }
    sides.push({
      label: 'admin',
      token: ctx.adminToken,
      ratingKey: group.adminRatingKey,
      items: adminItems,
      keys: new Set(adminItems.map((i) => i.ratingKey)),
      contributes: true
    })

    for (const member of next.members) {
      const token = getHomeUserToken(member.userUuid)
      if (!token) {
        member.needsAuth = true
        continue
      }
      // If the member was unreadable last round, this round it only adopts the
      // shared state (doesn't contribute) — avoids resurrecting removed items.
      const wasOffline = member.needsAuth === true
      try {
        const items = await readItems(ctx.uri, member.ratingKey, token)
        member.needsAuth = false
        sides.push({
          label: member.userUuid,
          token,
          ratingKey: member.ratingKey,
          items,
          keys: new Set(items.map((i) => i.ratingKey)),
          contributes: !wasOffline
        })
      } catch {
        // Token likely expired/revoked — flag for re-share, skip this round.
        member.needsAuth = true
      }
    }

    // --- Three-way merge (only contributing sides feed adds/removes) ---
    const baseline = new Set(group.baseline)
    const adds = new Set<string>()
    const removes = new Set<string>()
    for (const side of sides) {
      if (!side.contributes) continue
      for (const k of side.keys) if (!baseline.has(k)) adds.add(k)
      for (const k of baseline) if (!side.keys.has(k)) removes.add(k)
    }
    const target = new Set<string>(group.baseline)
    for (const k of adds) target.add(k)
    for (const k of removes) target.delete(k)

    const adminSide = sides.find((s) => s.label === 'admin')!
    const memberSides = sides.filter((s) => s.label !== 'admin')
    const ordered = orderTarget(
      target,
      adminSide.items.map((i) => i.ratingKey),
      group.baseline,
      memberSides.map((s) => s.items.map((i) => i.ratingKey))
    )

    // --- Converge each side to target ---
    // Only advance the baseline if EVERY side converged; otherwise a partial
    // failure would desync the baseline and create phantom adds next run.
    const ctxAdd = { uri: ctx.uri, machineId: ctx.machineId }
    let allOk = true
    for (const side of sides) {
      try {
        const toRemove = side.items
          .filter((i) => !target.has(i.ratingKey))
          .map((i) => i.playlistItemID)
        const toAdd = ordered.filter((k) => !side.keys.has(k))
        await removeItems(ctx.uri, side.ratingKey, side.token, toRemove)
        await addItems(ctxAdd, side.ratingKey, side.token, toAdd)
      } catch {
        allOk = false
      }
    }

    if (allOk) {
      next.baseline = ordered
      next.lastSyncedAt = Date.now()
      next.updatedAt = Date.now()
      delete next.lastError
    } else {
      next.lastError = 'Some copies could not be updated — will retry'
    }
  } catch (err) {
    next.lastError = err instanceof Error ? err.message : 'Sync failed'
  }
  saveSyncGroup(next)
  return next
}

// One reconcile at a time across ALL entry points (manual "Sync now" + the
// background interval) so they can't run concurrently and double-apply edits.
let syncing = false

/** Reconcile all synced groups for a server. */
export async function syncServer(serverId: string): Promise<void> {
  if (syncing) return
  syncing = true
  try {
    for (const group of getSyncedPlaylists().filter((g) => g.serverId === serverId)) {
      await syncGroup(group).catch(() => {})
    }
  } finally {
    syncing = false
  }
}

/** Reconcile every synced group across all servers. */
export async function syncAll(): Promise<void> {
  if (syncing) return
  syncing = true
  try {
    for (const group of getSyncedPlaylists()) {
      await syncGroup(group).catch(() => {})
    }
  } finally {
    syncing = false
  }
}

/**
 * Register (or extend) a sync group after a playlist has been copied into a
 * Home user's account. Adds the member and seeds the baseline on first use.
 */
export function enableSync(params: {
  serverId: string
  adminRatingKey: string
  title: string
  type: string
  userUuid: string
  userTitle: string
  memberRatingKey: string
  /** Item keys the copy was created with — seeds the baseline for a new group. */
  itemKeys: string[]
}): void {
  const existing = getSyncedPlaylists().find(
    (g) => g.serverId === params.serverId && g.adminRatingKey === params.adminRatingKey
  )
  const now = Date.now()
  const member = {
    userUuid: params.userUuid,
    userTitle: params.userTitle,
    ratingKey: params.memberRatingKey,
    needsAuth: false
  }
  if (existing) {
    const members = existing.members.filter((m) => m.userUuid !== params.userUuid)
    members.push(member)
    saveSyncGroup({ ...existing, title: params.title, type: params.type, members, updatedAt: now })
  } else {
    saveSyncGroup({
      serverId: params.serverId,
      adminRatingKey: params.adminRatingKey,
      title: params.title,
      type: params.type,
      baseline: [...params.itemKeys],
      members: [member],
      updatedAt: now
    })
  }
}

/** Stop syncing a group (existing copies are left untouched). */
export function disableSync(serverId: string, adminRatingKey: string): void {
  removeSyncGroup(serverId, adminRatingKey)
}

/** Map internal groups to the renderer-facing summary for a server. */
export function listSynced(serverId: string): SyncedPlaylist[] {
  return getSyncedPlaylists()
    .filter((g) => g.serverId === serverId)
    .map((g) => ({
      serverId: g.serverId,
      adminRatingKey: g.adminRatingKey,
      title: g.title,
      type: g.type,
      itemCount: g.baseline.length,
      members: g.members.map((m) => ({
        userUuid: m.userUuid,
        userTitle: m.userTitle,
        ratingKey: m.ratingKey,
        needsAuth: m.needsAuth
      })),
      updatedAt: g.updatedAt,
      lastSyncedAt: g.lastSyncedAt,
      lastError: g.lastError
    }))
}

let autoSyncTimer: ReturnType<typeof setInterval> | null = null

/** Start periodic background reconciliation (every 5 minutes). Idempotent. */
export function startAutoSync(): void {
  if (autoSyncTimer) return
  const tick = (): void => {
    if (getSyncedPlaylists().length === 0) return
    void syncAll() // self-guards against overlap via the `syncing` flag
  }
  // Kick off shortly after startup, then on a 5-minute cadence.
  setTimeout(tick, 15_000)
  autoSyncTimer = setInterval(tick, 5 * 60_000)
}
