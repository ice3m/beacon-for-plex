import dgram from 'node:dgram'
import http from 'node:http'
import { exec } from 'node:child_process'
import type { PlaybackStatus } from '@shared/types'
import { getClientIdentifier } from '../store'
import { PLEX_PRODUCT } from '../plex/headers'
import { registerTransientServer } from '../plex/servers'
import * as player from '../player/playback'

/**
 * Makes this app discoverable as a Plex player ("cast target") on the LAN and
 * accepts remote-control commands from the Plex phone/desktop apps.
 *
 * - GDM: responds to multicast discovery so controllers list us as a player.
 * - HTTP (port 3005): the Plex Companion control endpoints.
 * - Timelines: pushes playback state to subscribed controllers.
 *
 * Protocol is community-documented (see [[plex-companion-protocol]] memory);
 * LAN discovery is the primary path here.
 */

const HTTP_PORT = 3005
const GDM_PORTS = [32412, 32414] // bind both common player-discovery ports
const MULTICAST = '239.0.0.250'
const CAPS = 'timeline,playback,navigation,playqueues'

let httpServer: http.Server | null = null
let gdmSockets: dgram.Socket[] = []
let displayName = PLEX_PRODUCT
let lastStatus: PlaybackStatus = { active: false }

interface Subscriber {
  host: string
  port: number
  commandID: string
}
const subscribers = new Map<string, Subscriber>()

function id(): string {
  return getClientIdentifier()
}

function helloPacket(): Buffer {
  const lines = [
    'HTTP/1.0 200 OK',
    'Content-Type: plex/media-player',
    `Resource-Identifier: ${id()}`,
    `Name: ${displayName}`,
    `Port: ${HTTP_PORT}`,
    `Product: ${PLEX_PRODUCT}`,
    'Protocol: plex',
    'Protocol-Version: 1',
    `Protocol-Capabilities: ${CAPS}`,
    'Version: 1.0.0',
    'Device-Class: htpc',
    `Updated-At: ${Math.floor(Date.now() / 1000)}`
  ]
  return Buffer.from(lines.join('\r\n') + '\r\n')
}

function startGdm(): void {
  for (const port of GDM_PORTS) {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    sock.on('error', (err) => console.error('[companion] gdm error', port, err.message))
    sock.on('message', (msg, rinfo) => {
      if (msg.toString('utf-8').includes('M-SEARCH')) {
        const reply = helloPacket()
        sock.send(reply, 0, reply.length, rinfo.port, rinfo.address)
      }
    })
    // Bind explicitly on all interfaces so the join/replies aren't tied to a
    // single (possibly virtual) adapter.
    sock.bind(port, '0.0.0.0', () => {
      try {
        sock.addMembership(MULTICAST)
        sock.setBroadcast(true)
        sock.setMulticastTTL(4)
      } catch (err) {
        console.error('[companion] addMembership failed', port, (err as Error).message)
      }
    })
    gdmSockets.push(sock)
  }
}

// --- HTTP control server ---

function cors(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-Plex-Client-Identifier, X-Plex-Target-Client-Identifier, Accept')
  res.setHeader('Access-Control-Expose-Headers', 'X-Plex-Client-Identifier')
  res.setHeader('X-Plex-Client-Identifier', id())
}

function ok(res: http.ServerResponse, body = '<Response code="200" status="OK" />'): void {
  cors(res)
  res.setHeader('Content-Type', 'text/xml')
  res.writeHead(200)
  res.end(body)
}

function resourcesXml(): string {
  return (
    `<MediaContainer size="1">` +
    `<Player title="${displayName}" machineIdentifier="${id()}" product="${PLEX_PRODUCT}" ` +
    `platform="Windows" platformVersion="1.0" protocol="plex" protocolVersion="1" ` +
    `protocolCapabilities="${CAPS}" deviceClass="htpc" />` +
    `</MediaContainer>`
  )
}

function timelineXml(commandID: string): string {
  const s = lastStatus
  const state = !s.active ? 'stopped' : s.paused ? 'paused' : 'playing'
  const t = Math.floor(s.timeMs ?? 0)
  const d = Math.floor(s.durationMs ?? 0)
  const videoExtra =
    s.active && s.ratingKey
      ? ` time="${t}" duration="${d}" ratingKey="${s.ratingKey}" key="/library/metadata/${s.ratingKey}" ` +
        `volume="${s.volume ?? 100}" controllable="playPause,stop,seekTo,skipNext,skipPrevious,stepBack,stepForward,volume"`
      : ''
  return (
    `<MediaContainer commandID="${commandID}" location="navigation">` +
    `<Timeline type="video" state="${state}" machineIdentifier="${id()}"${videoExtra} />` +
    `<Timeline type="music" state="stopped" />` +
    `<Timeline type="photo" state="stopped" />` +
    `</MediaContainer>`
  )
}

/** Extract a numeric ratingKey from a Plex key like /library/metadata/123. */
function ratingKeyFromKey(key: string): string {
  const m = /(\d+)\/?$/.exec(key)
  return m ? m[1] : key
}

function handlePlayMedia(params: URLSearchParams): void {
  const key = params.get('key') ?? ''
  const machineIdentifier = params.get('machineIdentifier') ?? ''
  const address = params.get('address')
  const port = params.get('port')
  const protocol = params.get('protocol') ?? 'http'
  const token = params.get('token') ?? ''
  const offset = Number(params.get('offset') ?? '0')
  if (!key || !machineIdentifier) return

  if (address && port) {
    registerTransientServer(machineIdentifier, `${protocol}://${address}:${port}`, token)
  }
  const ratingKey = ratingKeyFromKey(key)
  console.log('[companion] playMedia', machineIdentifier, ratingKey, 'offset', offset)
  void player.start(machineIdentifier, ratingKey).then((res) => {
    if (res.ok) {
      // A cast should take over the screen: bring the app forward + fullscreen.
      player.presentForCast()
      if (offset > 1000) setTimeout(() => player.seekTo(offset), 1500)
    }
  })
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.method === 'OPTIONS') {
    cors(res)
    res.writeHead(200)
    res.end()
    return
  }
  const url = new URL(req.url ?? '/', `http://localhost:${HTTP_PORT}`)
  const path = url.pathname
  const q = url.searchParams

  try {
    if (path === '/resources') return ok(res, resourcesXml())

    // If a controller targets a specific player, ignore commands meant for a
    // different client (filters stray/cross-talk control traffic on the LAN).
    const target = req.headers['x-plex-target-client-identifier']
    if (path.startsWith('/player/') && typeof target === 'string' && target && target !== id()) {
      res.writeHead(404)
      res.end()
      return
    }

    if (path === '/player/playback/playMedia') {
      handlePlayMedia(q)
      return ok(res)
    }
    if (path === '/player/playback/play') return player.setPaused(false), ok(res)
    if (path === '/player/playback/pause') return player.setPaused(true), ok(res)
    if (path === '/player/playback/stop') return player.stop(), ok(res)
    if (path === '/player/playback/skipNext') return player.next(), ok(res)
    if (path === '/player/playback/skipPrevious') return player.prev(), ok(res)
    if (path === '/player/playback/stepBack') return player.seekBy(-15), ok(res)
    if (path === '/player/playback/stepForward') return player.seekBy(30), ok(res)
    if (path === '/player/playback/seekTo') {
      player.seekTo(Number(q.get('offset') ?? '0'))
      return ok(res)
    }
    if (path === '/player/playback/setParameters') {
      const vol = q.get('volume')
      if (vol != null) player.setVolume(Number(vol))
      return ok(res)
    }

    if (path === '/player/timeline/subscribe') {
      const port = Number(q.get('port') ?? '0')
      const commandID = q.get('commandID') ?? '0'
      const host = (req.socket.remoteAddress ?? '').replace('::ffff:', '')
      if (port && host) {
        subscribers.set(`${host}:${port}`, { host, port, commandID })
        sendTimelineTo({ host, port, commandID })
      }
      return ok(res)
    }
    if (path === '/player/timeline/unsubscribe') {
      const host = (req.socket.remoteAddress ?? '').replace('::ffff:', '')
      for (const k of [...subscribers.keys()]) if (k.startsWith(host)) subscribers.delete(k)
      return ok(res)
    }
    if (path === '/player/timeline/poll') {
      return ok(res, timelineXml(q.get('commandID') ?? '0'))
    }

    // Unknown command — acknowledge so controllers don't error out.
    return ok(res)
  } catch (err) {
    console.error('[companion] request error', path, err)
    ok(res)
  }
}

// --- Timeline push ---

function sendTimelineTo(sub: Subscriber): void {
  const body = timelineXml(sub.commandID)
  const req = http.request({
    host: sub.host,
    port: sub.port,
    path: '/:/timeline',
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'Content-Length': Buffer.byteLength(body),
      'X-Plex-Client-Identifier': id()
    }
  })
  // Drain + close the response so sockets don't leak; drop dead subscribers.
  req.on('response', (res) => res.resume())
  req.on('error', () => subscribers.delete(`${sub.host}:${sub.port}`))
  req.setTimeout(4000, () => req.destroy())
  req.end(body)
}

function onStatus(status: PlaybackStatus): void {
  lastStatus = status
  for (const sub of subscribers.values()) sendTimelineTo(sub)
}

// --- Lifecycle ---

export function startCompanion(name?: string): void {
  if (httpServer) return
  if (name) displayName = name
  ensureFirewall()
  httpServer = http.createServer(handleRequest)
  httpServer.on('error', (err) => console.error('[companion] http error', err.message))
  // Bind on all interfaces so the control server is reachable across the LAN.
  httpServer.listen(HTTP_PORT, '0.0.0.0', () => console.log(`[companion] control server on :${HTTP_PORT}`))
  startGdm()
  player.setStatusListener(onStatus)
  console.log('[companion] advertising as a Plex player:', displayName)
}

let firewallTried = false
/**
 * Best-effort Windows Firewall exceptions so inbound GDM (UDP) + control (TCP)
 * traffic reaches us. Succeeds only when elevated (installed app / admin);
 * otherwise a no-op — the installer also adds these rules.
 */
function ensureFirewall(): void {
  if (process.platform !== 'win32' || firewallTried) return
  firewallTried = true
  const rules = [
    'netsh advfirewall firewall add rule name="Plex Desktop Companion (UDP)" dir=in action=allow protocol=UDP localport=32410,32412,32413,32414',
    `netsh advfirewall firewall add rule name="Plex Desktop Companion (TCP)" dir=in action=allow protocol=TCP localport=${HTTP_PORT}`
  ]
  for (const rule of rules) {
    exec(rule, (err) => {
      if (err) console.log('[companion] firewall rule not added (needs admin):', err.message)
    })
  }
}

export function stopCompanion(): void {
  player.setStatusListener(null)
  subscribers.clear()
  for (const s of gdmSockets) {
    try {
      s.close()
    } catch {
      /* ignore */
    }
  }
  gdmSockets = []
  httpServer?.close()
  httpServer = null
  console.log('[companion] stopped')
}

export function isRunning(): boolean {
  return httpServer !== null
}
