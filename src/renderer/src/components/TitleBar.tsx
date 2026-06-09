import type { PlexAccount } from '@shared/types'
import plexLogo from '../assets/plex-logo.png'

interface Props {
  account: PlexAccount | null
  onLogout: () => void
}

/** App header with brand, account avatar, and sign-out. */
export function TitleBar({ account, onLogout }: Props): JSX.Element {
  return (
    <header
      className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 bg-surface-raised/80 px-5 backdrop-blur"
      // Lets the user drag the frameless window by the header.
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-2">
        <img src={plexLogo} alt="" className="h-5 w-5" />
        <span className="text-sm font-semibold tracking-wide">PLEX DESKTOP</span>
      </div>

      {account && (
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
          <span className="text-sm text-ink-muted">{account.title || account.username}</span>
          {account.thumb ? (
            <img
              src={account.thumb}
              alt=""
              className="h-7 w-7 rounded-full object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-accent/80" />
          )}
          <button
            onClick={onLogout}
            className="rounded-md px-2 py-1 text-xs text-ink-muted transition hover:bg-white/10 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}
