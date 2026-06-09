import { useCallback, useEffect, useState } from 'react'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useQuery } from '@tanstack/react-query'
import type { AuthStatus, PlexAccount, PlexServer } from '@shared/types'
import { persister, queryClient } from './lib/queryClient'
import { NavProvider } from './state/nav'
import { Login } from './components/Login'
import { ServerPicker } from './components/ServerPicker'
import { Shell } from './components/Shell'
import { MiniPlayer } from './components/MiniPlayer'
import { TitleBar } from './components/TitleBar'
import { UpdateBanner } from './components/UpdateBanner'
import { WhatsNew } from './components/WhatsNew'
import { Loading } from './components/States'

export default function App(): JSX.Element {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <Root />
    </PersistQueryClientProvider>
  )
}

type Auth =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'authed'; account: PlexAccount }

function Root(): JSX.Element {
  const [auth, setAuth] = useState<Auth>({ kind: 'loading' })

  const refresh = useCallback(async () => {
    try {
      const status: AuthStatus = await window.plex.auth.getStatus()
      setAuth(
        status.state === 'logged-in'
          ? { kind: 'authed', account: status.account }
          : { kind: 'login' }
      )
    } catch (err) {
      // Never hang on the loading spinner — fall back to the login screen.
      console.error('Failed to read auth status:', err)
      setAuth({ kind: 'login' })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleLogout = useCallback(async () => {
    await window.plex.auth.logout()
    queryClient.clear()
    setAuth({ kind: 'login' })
  }, [])

  return (
    <div className="flex h-full flex-col bg-surface text-ink">
      <TitleBar account={auth.kind === 'authed' ? auth.account : null} onLogout={handleLogout} />
      <main className="min-h-0 flex-1">
        {auth.kind === 'loading' && <Loading />}
        {auth.kind === 'login' && <Login onAuthenticated={refresh} />}
        {auth.kind === 'authed' && <ServerGate />}
      </main>
      <UpdateBanner />
      <WhatsNew />
    </div>
  )
}

/** Resolves the selected server (persisted across launches) then shows the Shell. */
function ServerGate(): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined)

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.plex.servers.list(),
    staleTime: 60_000
  })

  useEffect(() => {
    void window.plex.servers.getSelectedId().then((id) => setSelectedId(id))
  }, [])

  const choose = useCallback((server: PlexServer) => {
    void window.plex.servers.setSelectedId(server.clientIdentifier)
    setSelectedId(server.clientIdentifier)
  }, [])

  const switchServer = useCallback(() => {
    void window.plex.servers.setSelectedId(null)
    setSelectedId(null)
  }, [])

  if (selectedId === undefined) return <Loading />
  if (selectedId === null) return <ServerPicker onSelect={choose} />

  const server = servers?.find((s) => s.clientIdentifier === selectedId)
  // We have an id but haven't resolved its name yet — keep the shell usable
  // (data calls only need the id); show a neutral name until discovery returns.
  const serverName = server?.name ?? 'Plex Server'

  return (
    <NavProvider>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <Shell
            serverId={selectedId}
            serverName={serverName}
            owned={server?.owned ?? false}
            onSwitchServer={switchServer}
          />
        </div>
        <MiniPlayer serverId={selectedId} />
      </div>
    </NavProvider>
  )
}
