import type { PlexConnection, PlexServer } from '@shared/types'
import { getToken } from '../store'
import { plexHeaders } from './headers'

interface ResourceConnection {
  protocol: string
  address: string
  port: number
  uri: string
  local: boolean
  relay: boolean
}

interface Resource {
  name: string
  product: string
  productVersion: string
  clientIdentifier: string
  provides: string
  owned: boolean
  accessToken: string
  connections: ResourceConnection[]
}

/**
 * In-memory registry of discovered servers, keyed by machineIdentifier. Lets
 * the renderer reference servers by id while tokens + connections stay here in
 * the main process.
 */
const registry = new Map<string, PlexServer>()

/**
 * Register/refresh a server in the registry from a cast request (the phone
 * supplies address/port/token). No-op if we already know a reachable one.
 */
export function registerTransientServer(
  clientIdentifier: string,
  uri: string,
  accessToken: string
): void {
  const existing = registry.get(clientIdentifier)
  if (existing?.bestConnection) return
  const conn = {
    uri,
    address: uri,
    port: 0,
    protocol: uri.startsWith('https') ? 'https' : 'http',
    local: true,
    relay: false
  }
  registry.set(clientIdentifier, {
    name: existing?.name ?? 'Cast source',
    clientIdentifier,
    product: existing?.product ?? 'Plex Media Server',
    productVersion: existing?.productVersion ?? '',
    owned: existing?.owned ?? true,
    accessToken,
    connections: [conn],
    bestConnection: conn
  })
}

/**
 * Resolve a server by id, re-running discovery if it isn't cached yet (e.g. on
 * a fresh launch where the renderer asks for data before listing servers).
 */
export async function getServerById(serverId: string): Promise<PlexServer> {
  const cached = registry.get(serverId)
  if (cached?.bestConnection) return cached
  await listServers()
  const server = registry.get(serverId)
  if (!server) throw new Error(`Unknown server: ${serverId}`)
  return server
}

/**
 * Discover every Plex Media Server the account can reach, then probe each
 * server's connections to pick the fastest one that actually responds.
 */
export async function listServers(): Promise<PlexServer[]> {
  const token = getToken()
  if (!token) throw new Error('Not logged in')

  const res = await fetch(
    'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1',
    { headers: plexHeaders(token) }
  )
  if (!res.ok) throw new Error(`Failed to list resources (${res.status})`)
  const resources = (await res.json()) as Resource[]

  const servers = resources.filter((r) => r.provides.split(',').includes('server'))

  const resolved = await Promise.all(
    servers.map(async (r) => {
      const connections: PlexConnection[] = r.connections.map((c) => ({
        uri: c.uri,
        address: c.address,
        port: c.port,
        protocol: c.protocol,
        local: c.local,
        relay: c.relay
      }))
      const bestConnection = await probeConnections(connections, r.accessToken)
      return {
        name: r.name,
        clientIdentifier: r.clientIdentifier,
        product: r.product,
        productVersion: r.productVersion,
        owned: r.owned,
        accessToken: r.accessToken,
        connections,
        bestConnection
      }
    })
  )

  registry.clear()
  for (const server of resolved) registry.set(server.clientIdentifier, server)
  return resolved
}

/**
 * Race the candidate connections (local first, then remote, then relay) and
 * return the first that answers /identity within the timeout.
 */
async function probeConnections(
  connections: PlexConnection[],
  accessToken: string,
  timeoutMs = 4_000
): Promise<PlexConnection | null> {
  const ordered = [...connections].sort((a, b) => rank(a) - rank(b))

  const probes = ordered.map(
    (conn) =>
      new Promise<PlexConnection>((resolve, reject) => {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), timeoutMs)
        fetch(`${conn.uri}/identity`, {
          headers: plexHeaders(accessToken),
          signal: ctrl.signal
        })
          .then((r) => (r.ok ? resolve(conn) : reject(new Error('bad status'))))
          .catch(reject)
          .finally(() => clearTimeout(timer))
      })
  )

  try {
    return await Promise.any(probes)
  } catch {
    return null
  }
}

/** Lower rank = preferred. Local beats remote beats relay. */
function rank(c: PlexConnection): number {
  if (c.local) return 0
  if (c.relay) return 2
  return 1
}
