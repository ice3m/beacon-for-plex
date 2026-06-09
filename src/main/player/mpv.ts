import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { connect, type Socket } from 'node:net'
import { join } from 'node:path'
import { app } from 'electron'

/** Locate the bundled mpv.exe (dev: resources/, packaged: resourcesPath). */
export function resolveMpvPath(): string | null {
  const candidates = [
    join(app.getAppPath(), 'resources', 'mpv', 'mpv.exe'),
    join(process.resourcesPath ?? '', 'mpv', 'mpv.exe')
  ]
  return candidates.find((p) => p && existsSync(p)) ?? null
}

interface PendingReq {
  resolve: (value: unknown) => void
  reject: (err: Error) => void
}

/**
 * Thin wrapper around an mpv child process controlled via its JSON IPC
 * named pipe. Emits 'property' (name,data), 'end-file', 'started', 'exit'.
 */
export class MpvClient extends EventEmitter {
  private proc: ChildProcess | null = null
  private sock: Socket | null = null
  private pipePath: string
  private reqId = 1
  private pending = new Map<number, PendingReq>()
  private buf = ''
  private observeId = 1
  private killTimer: ReturnType<typeof setTimeout> | null = null

  /** True while the mpv process is running. */
  isAlive(): boolean {
    return this.proc !== null
  }

  constructor() {
    super()
    this.pipePath = `\\\\.\\pipe\\mpvplex-${process.pid}-${Date.now()}`
  }

  /**
   * Spawn mpv ONCE, IDLE, embedded in the given window handle. It then plays
   * titles via load() (loadfile) for the rest of its life — re-spawning mpv per
   * play intermittently deadlocked its video init, so we keep one instance and
   * its video output initializes only once.
   */
  async start(mpvPath: string, wid: string, globalArgs: string[]): Promise<void> {
    const args = [
      `--wid=${wid}`,
      `--input-ipc-server=${this.pipePath}`,
      '--force-window=yes',
      '--osc=no',
      '--keep-open=no',
      '--no-config',
      // Bound a stalled network read so a dropped connection surfaces promptly
      // (as end-of-file) instead of hanging — playback.ts then auto-resumes from
      // the current position. (Applies to mpv's HTTP/curl + lavf backends.)
      '--network-timeout=20',
      // Render via dxinterop (D3D9Ex + OpenGL) — reconfigures reliably on this
      // transparent window where the default D3D11 output did not.
      '--vo=gpu',
      '--gpu-context=dxinterop',
      // Software decode. Hardware (d3d11va/dxva2) HEVC decode hung at init on
      // this setup; CPU decode is reliable for every codec. Re-enable hwdec
      // later if 4K needs it.
      '--hwdec=no',
      // Stay alive with no file so we can loadfile new titles without respawning.
      '--idle=yes',
      ...globalArgs
    ]
    this.proc = spawn(mpvPath, args, { windowsHide: false })
    // Surface only mpv errors (keeps logs quiet during normal playback).
    this.proc.stderr?.on('data', (d) => console.error('[mpv]', String(d).trimEnd()))
    this.proc.on('exit', () => {
      this.cleanup()
      this.emit('exit')
    })
    this.proc.on('error', (err) => this.emit('error', err))
    await this.connectPipe()
    this.emit('started')
  }

  /** Load a new file, replacing the current one. Per-file settings are applied
   * via setProperty() before this call (loadfile's positional options arg has
   * version-specific arity that's easy to get wrong). */
  load(url: string): Promise<unknown> {
    return this.command('loadfile', url, 'replace')
  }

  /** Stop the current file but keep mpv alive (idle) for the next load. */
  stopFile(): Promise<unknown> {
    return this.command('stop').catch(() => undefined)
  }

  /** Connect to mpv's IPC pipe, retrying until mpv has created it. */
  private connectPipe(timeoutMs = 8000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    return new Promise((resolve, reject) => {
      const attempt = (): void => {
        const sock = connect(this.pipePath)
        sock.on('connect', () => {
          this.sock = sock
          sock.setEncoding('utf-8')
          sock.on('data', (chunk: string) => this.onData(chunk))
          sock.on('error', () => {})
          resolve()
        })
        sock.on('error', () => {
          sock.destroy()
          if (Date.now() > deadline) reject(new Error('mpv IPC connect timed out'))
          else setTimeout(attempt, 60)
        })
      }
      attempt()
    })
  }

  private onData(chunk: string): void {
    this.buf += chunk
    let nl: number
    while ((nl = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, nl).trim()
      this.buf = this.buf.slice(nl + 1)
      if (!line) continue
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (typeof msg.request_id === 'number' && this.pending.has(msg.request_id)) {
        const p = this.pending.get(msg.request_id)!
        this.pending.delete(msg.request_id)
        if (msg.error && msg.error !== 'success') p.reject(new Error(String(msg.error)))
        else p.resolve(msg.data)
      } else if (typeof msg.event === 'string') {
        if (msg.event === 'property-change') this.emit('property', msg.name, msg.data)
        else if (msg.event === 'end-file') this.emit('end-file', msg.reason)
        else this.emit(msg.event)
      }
    }
  }

  /** Send a command array to mpv and await its reply (rejects after 10s). */
  command(...args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.sock) return reject(new Error('mpv not connected'))
      const id = this.reqId++
      // Reject + drop the pending entry if mpv never replies (hung pipe).
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error('mpv command timed out'))
      }, 10000)
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer)
          resolve(v)
        },
        reject: (e) => {
          clearTimeout(timer)
          reject(e)
        }
      })
      this.sock.write(JSON.stringify({ command: args, request_id: id }) + '\n')
    })
  }

  setProperty(name: string, value: unknown): Promise<unknown> {
    return this.command('set_property', name, value)
  }

  observeProperty(name: string): void {
    void this.command('observe_property', this.observeId++, name).catch(() => {})
  }

  /** Ask mpv to quit; the 'exit' event fires once the process ends. */
  quit(): void {
    this.command('quit').catch(() => {})
    // Hard stop as a fallback if IPC is unresponsive (captured proc, cleared on exit).
    const proc = this.proc
    this.killTimer = setTimeout(() => proc?.kill(), 500)
  }

  private cleanup(): void {
    if (this.killTimer) {
      clearTimeout(this.killTimer)
      this.killTimer = null
    }
    for (const p of this.pending.values()) p.reject(new Error('mpv closed'))
    this.pending.clear()
    this.sock?.destroy()
    this.sock = null
    this.proc = null
  }
}
