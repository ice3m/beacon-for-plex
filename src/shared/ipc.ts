// IPC channel names — single source of truth for main <-> renderer messaging.
export const IPC = {
  auth: {
    getStatus: 'auth:getStatus',
    startLogin: 'auth:startLogin',
    waitForLogin: 'auth:waitForLogin',
    logout: 'auth:logout'
  },
  servers: {
    list: 'servers:list',
    getSelectedId: 'servers:getSelectedId',
    setSelectedId: 'servers:setSelectedId'
  },
  library: {
    sections: 'library:sections',
    sectionContents: 'library:sectionContents',
    sectionMeta: 'library:sectionMeta',
    filterValues: 'library:filterValues',
    search: 'library:search',
    homeHubs: 'library:homeHubs',
    onDeck: 'library:onDeck',
    recentlyAdded: 'library:recentlyAdded',
    sectionHubs: 'library:sectionHubs',
    metadata: 'library:metadata',
    children: 'library:children',
    related: 'library:related',
    collections: 'library:collections',
    allCollections: 'library:allCollections',
    collectionItems: 'library:collectionItems',
    byActor: 'library:byActor',
    genres: 'library:genres',
    randomPick: 'library:randomPick',
    history: 'library:history',
    serverAccounts: 'library:serverAccounts',
    getHiddenHistoryUsers: 'library:getHiddenHistoryUsers',
    setHistoryUserHidden: 'library:setHistoryUserHidden',
    setLibraryIcon: 'library:setLibraryIcon',
    setLibraryHidden: 'library:setLibraryHidden',
    setLibraryOrder: 'library:setLibraryOrder',
    markPlayed: 'library:markPlayed',
    markUnplayed: 'library:markUnplayed',
    updateProgress: 'library:updateProgress'
  },
  settings: {
    getPrefs: 'settings:getPrefs',
    setPref: 'settings:setPref',
    getPlaybackPrefs: 'settings:getPlaybackPrefs',
    setPlaybackPrefs: 'settings:setPlaybackPrefs'
  },
  playlists: {
    list: 'playlists:list',
    items: 'playlists:items',
    create: 'playlists:create',
    addItems: 'playlists:addItems',
    removeItem: 'playlists:removeItem',
    remove: 'playlists:remove',
    shareToUser: 'playlists:shareToUser',
    listSynced: 'playlists:listSynced',
    syncNow: 'playlists:syncNow',
    unsync: 'playlists:unsync'
  },
  users: {
    listHome: 'users:listHome'
  },
  watchlist: {
    list: 'watchlist:list',
    add: 'watchlist:add',
    remove: 'watchlist:remove'
  },
  playback: {
    start: 'playback:start',
    stop: 'playback:stop',
    playPause: 'playback:playPause',
    seekTo: 'playback:seekTo',
    seekBy: 'playback:seekBy',
    setVolume: 'playback:setVolume',
    next: 'playback:next',
    prev: 'playback:prev',
    minimize: 'playback:minimize',
    expand: 'playback:expand',
    setQuality: 'playback:setQuality',
    setSpeed: 'playback:setSpeed',
    setSubScale: 'playback:setSubScale',
    toggleFullscreen: 'playback:toggleFullscreen',
    togglePip: 'playback:togglePip',
    cancelUpNext: 'playback:cancelUpNext',
    skip: 'playback:skip',
    mediaInfo: 'playback:mediaInfo',
    audioTracks: 'playback:audioTracks',
    subtitleOptions: 'playback:subtitleOptions',
    selectAudio: 'playback:selectAudio',
    selectSubtitle: 'playback:selectSubtitle',
    searchSubtitles: 'playback:searchSubtitles',
    downloadSubtitle: 'playback:downloadSubtitle',
    /** Main → renderer event channel for status pushes. */
    status: 'playback:status'
  },
  cache: {
    start: 'cache:start',
    cancel: 'cache:cancel',
    getStatus: 'cache:getStatus',
    size: 'cache:size',
    clear: 'cache:clear',
    /** Main → renderer event channel for prewarm progress. */
    status: 'cache:status'
  },
  system: {
    openExternal: 'system:openExternal'
  },
  updates: {
    install: 'updates:install',
    /** Main → renderer event channel for auto-update progress. */
    status: 'updates:status'
  }
} as const

/** Custom protocol scheme used to serve (and locally cache) Plex artwork. */
export const PLEX_IMG_SCHEME = 'plex-img'

/**
 * Build a renderer-safe artwork URL. The main process resolves it against the
 * server's connection + token and caches the bytes on disk.
 */
export function imageUrl(
  serverId: string,
  path: string | undefined,
  opts: { width?: number; height?: number } = {}
): string | undefined {
  if (!path) return undefined
  const params = new URLSearchParams({ server: serverId, path })
  if (opts.width) params.set('w', String(opts.width))
  if (opts.height) params.set('h', String(opts.height))
  return `${PLEX_IMG_SCHEME}://i/?${params.toString()}`
}
