import { useState } from 'react'
import plexLogo from '../assets/plex-logo.png'

interface Props {
  onAuthenticated: () => void
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'waiting'; code: string }
  | { kind: 'error'; message: string }

/**
 * Drives the plex.tv PIN flow from the UI: kick off a PIN, open the browser for
 * the user to authorize, then poll until the main process reports success.
 */
export function Login({ onAuthenticated }: Props): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  async function signIn(): Promise<void> {
    try {
      const pin = await window.plex.auth.startLogin()
      setPhase({ kind: 'waiting', code: pin.code })
      await window.plex.system.openExternal(pin.authUrl)
      await window.plex.auth.waitForLogin(pin.id)
      onAuthenticated()
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'Login failed' })
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      {/* Cinematic gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/20 via-surface to-surface" />
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-surface-raised/70 p-10 text-center shadow-2xl backdrop-blur">
        <img src={plexLogo} alt="Plex" className="mx-auto mb-6 h-16 w-16" />
        <h1 className="mb-2 text-2xl font-bold">Welcome back</h1>
        <p className="mb-8 text-sm text-ink-muted">
          Sign in with your Plex account to start streaming.
        </p>

        {phase.kind === 'waiting' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 text-ink-muted">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink-muted border-t-accent" />
              <span className="text-sm">Waiting for authorization…</span>
            </div>
            <p className="text-xs text-ink-muted">
              A browser window opened for you to sign in. Linking code:{' '}
              <span className="font-mono font-semibold text-ink">{phase.code}</span>
            </p>
          </div>
        ) : (
          <button
            onClick={signIn}
            className="w-full rounded-lg bg-accent py-3 font-semibold text-white transition hover:brightness-110 active:brightness-95"
          >
            Sign in with Plex
          </button>
        )}

        {phase.kind === 'error' && (
          <p className="mt-4 text-sm text-red-400">{phase.message}</p>
        )}
      </div>
    </div>
  )
}
