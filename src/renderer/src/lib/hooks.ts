import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import type { SectionQuery } from '@shared/types'

/** Page size for library grids — large enough to feel instant, paged for scale. */
const PAGE_SIZE = 100

// Centralized query keys so invalidation stays consistent.
export const keys = {
  sections: (s: string) => ['sections', s] as const,
  sectionContents: (s: string, id: string, q?: SectionQuery) =>
    ['sectionContents', s, id, q ?? {}] as const,
  homeHubs: (s: string) => ['homeHubs', s] as const,
  sectionHubs: (s: string, id: string) => ['sectionHubs', s, id] as const,
  metadata: (s: string, rk: string) => ['metadata', s, rk] as const,
  children: (s: string, rk: string) => ['children', s, rk] as const,
  playlists: (s: string) => ['playlists', s] as const,
  playlistItems: (s: string, rk: string) => ['playlistItems', s, rk] as const,
  syncedPlaylists: (s: string) => ['syncedPlaylists', s] as const
}

export function useSections(serverId: string) {
  return useQuery({
    queryKey: keys.sections(serverId),
    queryFn: () => window.plex.library.sections(serverId),
    enabled: !!serverId,
    // Hidden/icon/order live in the main store but are baked into this list,
    // so always revalidate on mount to reflect changes from a prior session.
    staleTime: 0,
    refetchOnMount: 'always'
  })
}

export function useHomeHubs(serverId: string) {
  return useQuery({
    queryKey: keys.homeHubs(serverId),
    queryFn: () => window.plex.library.homeHubs(serverId),
    enabled: !!serverId
  })
}

export function useOnDeck(serverId: string) {
  return useQuery({
    queryKey: ['onDeck', serverId],
    queryFn: () => window.plex.library.onDeck(serverId),
    enabled: !!serverId,
    // Continue Watching reflects playback that can happen in other Plex apps,
    // so always revalidate on mount and when the window regains focus.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  })
}

export function useRecentlyAdded(serverId: string, sectionId: string, sectionType: string) {
  return useQuery({
    queryKey: ['recentlyAdded', serverId, sectionId],
    queryFn: () => window.plex.library.recentlyAdded(serverId, sectionId, sectionType),
    enabled: !!serverId && !!sectionId
  })
}

export function useSectionHubs(serverId: string, sectionId: string) {
  return useQuery({
    queryKey: keys.sectionHubs(serverId, sectionId),
    queryFn: () => window.plex.library.sectionHubs(serverId, sectionId),
    enabled: !!serverId && !!sectionId
  })
}

export function useSectionContents(serverId: string, sectionId: string, query?: SectionQuery) {
  return useQuery({
    queryKey: keys.sectionContents(serverId, sectionId, query),
    queryFn: () => window.plex.library.sectionContents(serverId, sectionId, query),
    enabled: !!serverId && !!sectionId
  })
}

interface SectionOpts {
  sort: string
  type?: number
  filters?: { key: string; value: string }[]
}

/**
 * Paged, infinite-scroll library contents — the scalable path for large
 * libraries. Pages accumulate in the cache so scrolling back up is instant.
 */
export function useInfiniteSection(serverId: string, sectionId: string, opts: SectionOpts) {
  return useInfiniteQuery({
    queryKey: ['sectionInfinite', serverId, sectionId, opts],
    queryFn: ({ pageParam }) =>
      window.plex.library.sectionContents(serverId, sectionId, {
        sort: opts.sort,
        type: opts.type,
        filters: opts.filters,
        start: pageParam,
        size: PAGE_SIZE
      }),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.offset + last.items.length
      return next < last.totalSize ? next : undefined
    },
    enabled: !!serverId && !!sectionId
  })
}

export function useSectionMeta(serverId: string, sectionId: string, type: number) {
  return useQuery({
    queryKey: ['sectionMeta', serverId, sectionId, type],
    queryFn: () => window.plex.library.sectionMeta(serverId, sectionId, type),
    enabled: !!serverId && !!sectionId && type > 0,
    staleTime: 60 * 60 * 1000
  })
}

export function useFilterValues(serverId: string, filterKey: string, enabled: boolean) {
  return useQuery({
    queryKey: ['filterValues', serverId, filterKey],
    queryFn: () => window.plex.library.filterValues(serverId, filterKey),
    enabled: enabled && !!serverId && !!filterKey,
    staleTime: 60 * 60 * 1000
  })
}

export function useSearch(serverId: string, query: string) {
  return useQuery({
    queryKey: ['search', serverId, query],
    queryFn: () => window.plex.library.search(serverId, query),
    enabled: !!serverId && query.trim().length >= 2,
    placeholderData: (prev) => prev, // keep prior results visible while typing
    staleTime: 30 * 1000
  })
}

export function useMetadata(serverId: string, ratingKey: string) {
  return useQuery({
    queryKey: keys.metadata(serverId, ratingKey),
    queryFn: () => window.plex.library.metadata(serverId, ratingKey),
    enabled: !!serverId && !!ratingKey
  })
}

export function useCollections(serverId: string, sectionId: string) {
  return useQuery({
    queryKey: ['collections', serverId, sectionId],
    queryFn: () => window.plex.library.collections(serverId, sectionId),
    enabled: !!serverId && !!sectionId
  })
}

/** All collections across the server's visible libraries (sidebar view). */
export function useAllCollections(serverId: string) {
  return useQuery({
    queryKey: ['allCollections', serverId],
    queryFn: () => window.plex.library.allCollections(serverId),
    enabled: !!serverId
  })
}

export function useCollectionItems(serverId: string, ratingKey: string) {
  return useQuery({
    queryKey: ['collectionItems', serverId, ratingKey],
    queryFn: () => window.plex.library.collectionItems(serverId, ratingKey),
    enabled: !!serverId && !!ratingKey
  })
}

export function useByActor(serverId: string, sectionId: string, actorId: string) {
  return useQuery({
    queryKey: ['byActor', serverId, sectionId, actorId],
    queryFn: () => window.plex.library.byActor(serverId, sectionId, actorId),
    enabled: !!serverId && !!sectionId && !!actorId
  })
}

export function useRelated(serverId: string, ratingKey: string) {
  return useQuery({
    queryKey: ['related', serverId, ratingKey],
    queryFn: () => window.plex.library.related(serverId, ratingKey),
    enabled: !!serverId && !!ratingKey
  })
}

export function useChildren(serverId: string, ratingKey: string, enabled = true) {
  return useQuery({
    queryKey: keys.children(serverId, ratingKey),
    queryFn: () => window.plex.library.children(serverId, ratingKey),
    enabled: enabled && !!serverId && !!ratingKey
  })
}

export function useHomeUsers() {
  return useQuery({
    queryKey: ['homeUsers'],
    queryFn: () => window.plex.users.listHome(),
    staleTime: 5 * 60 * 1000
  })
}

export function usePlaylists(serverId: string) {
  return useQuery({
    queryKey: keys.playlists(serverId),
    queryFn: () => window.plex.playlists.list(serverId),
    enabled: !!serverId
  })
}

export function usePlaylistItems(serverId: string, ratingKey: string) {
  return useQuery({
    queryKey: keys.playlistItems(serverId, ratingKey),
    queryFn: () => window.plex.playlists.items(serverId, ratingKey),
    enabled: !!serverId && !!ratingKey
  })
}

/** Set/clear a library's local custom icon and refresh the sections list. */
export function useSetLibraryIcon(serverId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sectionId, icon }: { sectionId: string; icon: string | null }) =>
      window.plex.library.setLibraryIcon(sectionId, icon),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sections(serverId) })
  })
}

/** Show/hide a library in the sidebar (client-side). */
export function useSetLibraryHidden(serverId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sectionId, hidden }: { sectionId: string; hidden: boolean }) =>
      window.plex.library.setLibraryHidden(sectionId, hidden),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sections(serverId) })
  })
}

/** Persist a new sidebar library order. */
export function useSetLibraryOrder(serverId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) => window.plex.library.setLibraryOrder(orderedIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sections(serverId) })
  })
}

export function useDeletePlaylist(serverId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ratingKey: string) => window.plex.playlists.remove(serverId, ratingKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.playlists(serverId) })
  })
}

/** Playlists kept in two-way sync with Home users on this server. */
export function useSyncedPlaylists(serverId: string) {
  return useQuery({
    queryKey: keys.syncedPlaylists(serverId),
    queryFn: () => window.plex.playlists.listSynced(serverId),
    enabled: !!serverId
  })
}

/** Force a reconcile of all synced playlists, then refresh caches. */
export function useSyncNow(serverId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => window.plex.playlists.syncNow(serverId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.syncedPlaylists(serverId) })
      qc.invalidateQueries({ queryKey: keys.playlists(serverId) })
    }
  })
}

/** Stop two-way syncing a playlist group. */
export function useUnsync(serverId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (adminRatingKey: string) => window.plex.playlists.unsync(serverId, adminRatingKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.syncedPlaylists(serverId) })
  })
}

/** Recently watched items (play history). */
export function useHistory(serverId: string, accountId?: number) {
  return useQuery({
    queryKey: ['history', serverId, accountId ?? 'all'],
    queryFn: () => window.plex.library.history(serverId, accountId),
    enabled: !!serverId,
    // Watch history changes from any Plex app — keep it fresh.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  })
}

/** Accounts (owner + shared users) known to the server, for the history filter. */
export function useServerAccounts(serverId: string) {
  return useQuery({
    queryKey: ['serverAccounts', serverId],
    queryFn: () => window.plex.library.serverAccounts(serverId),
    enabled: !!serverId,
    staleTime: 10 * 60 * 1000
  })
}

/** Server account ids the user has hidden from the history dropdown. */
export function useHiddenHistoryUsers() {
  return useQuery({
    queryKey: ['hiddenHistoryUsers'],
    queryFn: () => window.plex.library.getHiddenHistoryUsers(),
    staleTime: 60 * 1000
  })
}

/** The currently signed-in Plex account (or null). */
export function useCurrentAccount() {
  return useQuery({
    queryKey: ['currentAccount'],
    queryFn: async () => {
      const status = await window.plex.auth.getStatus()
      return status.state === 'logged-in' ? status.account : null
    },
    staleTime: 10 * 60 * 1000
  })
}

/** The personal watchlist for a server. */
export function useWatchlist(serverId: string) {
  return useQuery({
    queryKey: ['watchlist', serverId],
    queryFn: () => window.plex.watchlist.list(serverId),
    enabled: !!serverId
  })
}

/** Add/remove watchlist mutations that update the cached list in place. */
export function useToggleWatchlist(serverId: string) {
  const qc = useQueryClient()
  const add = useMutation({
    mutationFn: (entry: import('@shared/types').WatchlistEntry) =>
      window.plex.watchlist.add(serverId, entry),
    onSuccess: (list) => qc.setQueryData(['watchlist', serverId], list)
  })
  const remove = useMutation({
    mutationFn: (ratingKey: string) => window.plex.watchlist.remove(serverId, ratingKey),
    onSuccess: (list) => qc.setQueryData(['watchlist', serverId], list)
  })
  return { add, remove }
}

/** Genre titles across the chosen (or all video) libraries, for the picker. */
export function useGenres(serverId: string, sectionIds: string[]) {
  return useQuery({
    queryKey: ['genres', serverId, [...sectionIds].sort()],
    queryFn: () => window.plex.library.genres(serverId, sectionIds),
    enabled: !!serverId,
    staleTime: 10 * 60 * 1000
  })
}

/** On-demand random pick honoring the selected libraries + genre. */
export function useRandomPick(serverId: string) {
  return useMutation({
    mutationFn: (opts: { sectionIds?: string[]; genre?: string }) =>
      window.plex.library.randomPick(serverId, opts)
  })
}

/** Toggle watched state, then refresh the views that show progress badges. */
export function useSetWatched(serverId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ratingKey, played }: { ratingKey: string; played: boolean }) =>
      played
        ? window.plex.library.markPlayed(serverId, ratingKey)
        : window.plex.library.markUnplayed(serverId, ratingKey),
    onSuccess: (_d, { ratingKey }) => {
      qc.invalidateQueries({ queryKey: keys.metadata(serverId, ratingKey) })
      qc.invalidateQueries({ queryKey: keys.homeHubs(serverId) })
      qc.invalidateQueries({ queryKey: ['sectionInfinite', serverId] })
    }
  })
}

export function usePlaybackPrefs() {
  return useQuery({
    queryKey: ['playbackPrefs'],
    queryFn: () => window.plex.settings.getPlaybackPrefs(),
    staleTime: Infinity
  })
}

export function useSetPlaybackPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prefs: import('@shared/types').PlaybackPrefs) =>
      window.plex.settings.setPlaybackPrefs(prefs),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playbackPrefs'] })
  })
}

export function useServerPrefs(serverId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['serverPrefs', serverId],
    queryFn: () => window.plex.settings.getPrefs(serverId),
    enabled: enabled && !!serverId,
    staleTime: 30_000
  })
}

export function useSetServerPref(serverId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      window.plex.settings.setPref(serverId, id, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['serverPrefs', serverId] })
  })
}
