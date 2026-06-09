import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'

/**
 * Durable, local metadata cache. Queries are kept in memory by React Query and
 * mirrored to IndexedDB, so a relaunch paints instantly from disk and then
 * revalidates in the background (stale-while-revalidate) — the core of the
 * "fast loading" goal.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min: serve cached, revalidate in background
      gcTime: 24 * 60 * 60 * 1000, // keep on disk for a day
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

const idbStorage = {
  getItem: (key: string) => get<string>(key).then((v) => v ?? null),
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key)
}

export const persister = createAsyncStoragePersister({
  storage: idbStorage,
  key: 'plex-desktop-cache'
})
