import { contextBridge, ipcRenderer } from 'electron'
import type { PlexApi } from '@shared/types'
import { IPC } from '@shared/ipc'

// The single, typed bridge object the renderer talks through. No direct
// ipcRenderer / node access leaks into the web context.
const api: PlexApi = {
  auth: {
    getStatus: () => ipcRenderer.invoke(IPC.auth.getStatus),
    startLogin: () => ipcRenderer.invoke(IPC.auth.startLogin),
    waitForLogin: (pinId) => ipcRenderer.invoke(IPC.auth.waitForLogin, pinId),
    logout: () => ipcRenderer.invoke(IPC.auth.logout)
  },
  servers: {
    list: () => ipcRenderer.invoke(IPC.servers.list),
    getSelectedId: () => ipcRenderer.invoke(IPC.servers.getSelectedId),
    setSelectedId: (serverId) => ipcRenderer.invoke(IPC.servers.setSelectedId, serverId)
  },
  library: {
    sections: (serverId) => ipcRenderer.invoke(IPC.library.sections, serverId),
    sectionContents: (serverId, sectionId, query) =>
      ipcRenderer.invoke(IPC.library.sectionContents, serverId, sectionId, query),
    sectionMeta: (serverId, sectionId, type) =>
      ipcRenderer.invoke(IPC.library.sectionMeta, serverId, sectionId, type),
    filterValues: (serverId, filterKey) =>
      ipcRenderer.invoke(IPC.library.filterValues, serverId, filterKey),
    search: (serverId, query) => ipcRenderer.invoke(IPC.library.search, serverId, query),
    homeHubs: (serverId) => ipcRenderer.invoke(IPC.library.homeHubs, serverId),
    onDeck: (serverId) => ipcRenderer.invoke(IPC.library.onDeck, serverId),
    recentlyAdded: (serverId, sectionId, sectionType) =>
      ipcRenderer.invoke(IPC.library.recentlyAdded, serverId, sectionId, sectionType),
    sectionHubs: (serverId, sectionId) =>
      ipcRenderer.invoke(IPC.library.sectionHubs, serverId, sectionId),
    metadata: (serverId, ratingKey) =>
      ipcRenderer.invoke(IPC.library.metadata, serverId, ratingKey),
    children: (serverId, ratingKey) =>
      ipcRenderer.invoke(IPC.library.children, serverId, ratingKey),
    related: (serverId, ratingKey) =>
      ipcRenderer.invoke(IPC.library.related, serverId, ratingKey),
    collections: (serverId, sectionId) =>
      ipcRenderer.invoke(IPC.library.collections, serverId, sectionId),
    allCollections: (serverId) => ipcRenderer.invoke(IPC.library.allCollections, serverId),
    collectionItems: (serverId, ratingKey) =>
      ipcRenderer.invoke(IPC.library.collectionItems, serverId, ratingKey),
    byActor: (serverId, sectionId, actorId) =>
      ipcRenderer.invoke(IPC.library.byActor, serverId, sectionId, actorId),
    genres: (serverId, sectionIds) => ipcRenderer.invoke(IPC.library.genres, serverId, sectionIds),
    randomPick: (serverId, opts) => ipcRenderer.invoke(IPC.library.randomPick, serverId, opts),
    history: (serverId, accountId) => ipcRenderer.invoke(IPC.library.history, serverId, accountId),
    serverAccounts: (serverId) => ipcRenderer.invoke(IPC.library.serverAccounts, serverId),
    getHiddenHistoryUsers: () => ipcRenderer.invoke(IPC.library.getHiddenHistoryUsers),
    setHistoryUserHidden: (accountId, hidden) =>
      ipcRenderer.invoke(IPC.library.setHistoryUserHidden, accountId, hidden),
    setLibraryIcon: (sectionId, icon) =>
      ipcRenderer.invoke(IPC.library.setLibraryIcon, sectionId, icon),
    setLibraryHidden: (sectionId, hidden) =>
      ipcRenderer.invoke(IPC.library.setLibraryHidden, sectionId, hidden),
    setLibraryOrder: (orderedIds) =>
      ipcRenderer.invoke(IPC.library.setLibraryOrder, orderedIds),
    markPlayed: (serverId, ratingKey) =>
      ipcRenderer.invoke(IPC.library.markPlayed, serverId, ratingKey),
    markUnplayed: (serverId, ratingKey) =>
      ipcRenderer.invoke(IPC.library.markUnplayed, serverId, ratingKey),
    updateProgress: (serverId, ratingKey, timeMs, state) =>
      ipcRenderer.invoke(IPC.library.updateProgress, serverId, ratingKey, timeMs, state)
  },
  settings: {
    getPrefs: (serverId) => ipcRenderer.invoke(IPC.settings.getPrefs, serverId),
    setPref: (serverId, id, value) => ipcRenderer.invoke(IPC.settings.setPref, serverId, id, value),
    getPlaybackPrefs: () => ipcRenderer.invoke(IPC.settings.getPlaybackPrefs),
    setPlaybackPrefs: (prefs) => ipcRenderer.invoke(IPC.settings.setPlaybackPrefs, prefs)
  },
  playlists: {
    list: (serverId) => ipcRenderer.invoke(IPC.playlists.list, serverId),
    items: (serverId, ratingKey) => ipcRenderer.invoke(IPC.playlists.items, serverId, ratingKey),
    create: (serverId, title, type, itemRatingKeys) =>
      ipcRenderer.invoke(IPC.playlists.create, serverId, title, type, itemRatingKeys),
    addItems: (serverId, ratingKey, itemRatingKeys) =>
      ipcRenderer.invoke(IPC.playlists.addItems, serverId, ratingKey, itemRatingKeys),
    removeItem: (serverId, ratingKey, playlistItemID) =>
      ipcRenderer.invoke(IPC.playlists.removeItem, serverId, ratingKey, playlistItemID),
    remove: (serverId, ratingKey) => ipcRenderer.invoke(IPC.playlists.remove, serverId, ratingKey),
    shareToUser: (serverId, ratingKey, userUuid, pin, keepInSync) =>
      ipcRenderer.invoke(IPC.playlists.shareToUser, serverId, ratingKey, userUuid, pin, keepInSync),
    listSynced: (serverId) => ipcRenderer.invoke(IPC.playlists.listSynced, serverId),
    syncNow: (serverId) => ipcRenderer.invoke(IPC.playlists.syncNow, serverId),
    unsync: (serverId, adminRatingKey) =>
      ipcRenderer.invoke(IPC.playlists.unsync, serverId, adminRatingKey)
  },
  users: {
    listHome: () => ipcRenderer.invoke(IPC.users.listHome)
  },
  watchlist: {
    list: (serverId) => ipcRenderer.invoke(IPC.watchlist.list, serverId),
    add: (serverId, entry) => ipcRenderer.invoke(IPC.watchlist.add, serverId, entry),
    remove: (serverId, ratingKey) => ipcRenderer.invoke(IPC.watchlist.remove, serverId, ratingKey)
  },
  playback: {
    start: (serverId, ratingKey) => ipcRenderer.invoke(IPC.playback.start, serverId, ratingKey),
    stop: () => ipcRenderer.invoke(IPC.playback.stop),
    playPause: () => ipcRenderer.invoke(IPC.playback.playPause),
    seekTo: (ms) => ipcRenderer.invoke(IPC.playback.seekTo, ms),
    seekBy: (seconds) => ipcRenderer.invoke(IPC.playback.seekBy, seconds),
    setVolume: (volume) => ipcRenderer.invoke(IPC.playback.setVolume, volume),
    next: () => ipcRenderer.invoke(IPC.playback.next),
    prev: () => ipcRenderer.invoke(IPC.playback.prev),
    minimize: () => ipcRenderer.invoke(IPC.playback.minimize),
    expand: () => ipcRenderer.invoke(IPC.playback.expand),
    setQuality: (qualityId) => ipcRenderer.invoke(IPC.playback.setQuality, qualityId),
    setSpeed: (speed) => ipcRenderer.invoke(IPC.playback.setSpeed, speed),
    setSubScale: (scale) => ipcRenderer.invoke(IPC.playback.setSubScale, scale),
    toggleFullscreen: () => ipcRenderer.invoke(IPC.playback.toggleFullscreen),
    togglePip: () => ipcRenderer.invoke(IPC.playback.togglePip),
    cancelUpNext: () => ipcRenderer.invoke(IPC.playback.cancelUpNext),
    skip: () => ipcRenderer.invoke(IPC.playback.skip),
    mediaInfo: () => ipcRenderer.invoke(IPC.playback.mediaInfo),
    audioTracks: () => ipcRenderer.invoke(IPC.playback.audioTracks),
    subtitleOptions: () => ipcRenderer.invoke(IPC.playback.subtitleOptions),
    selectAudio: (id) => ipcRenderer.invoke(IPC.playback.selectAudio, id),
    selectSubtitle: (opt) => ipcRenderer.invoke(IPC.playback.selectSubtitle, opt),
    searchSubtitles: () => ipcRenderer.invoke(IPC.playback.searchSubtitles),
    downloadSubtitle: (key) => ipcRenderer.invoke(IPC.playback.downloadSubtitle, key),
    onStatus: (cb) => {
      const listener = (_e: unknown, status: Parameters<typeof cb>[0]): void => cb(status)
      ipcRenderer.on(IPC.playback.status, listener)
      return () => ipcRenderer.removeListener(IPC.playback.status, listener)
    }
  },
  cache: {
    start: (serverId) => ipcRenderer.invoke(IPC.cache.start, serverId),
    cancel: () => ipcRenderer.invoke(IPC.cache.cancel),
    getStatus: () => ipcRenderer.invoke(IPC.cache.getStatus),
    size: () => ipcRenderer.invoke(IPC.cache.size),
    clear: () => ipcRenderer.invoke(IPC.cache.clear),
    onStatus: (cb) => {
      const listener = (_e: unknown, status: Parameters<typeof cb>[0]): void => cb(status)
      ipcRenderer.on(IPC.cache.status, listener)
      return () => ipcRenderer.removeListener(IPC.cache.status, listener)
    }
  },
  system: {
    openExternal: (url) => ipcRenderer.invoke(IPC.system.openExternal, url)
  },
  updates: {
    onStatus: (cb) => {
      const listener = (_e: unknown, status: Parameters<typeof cb>[0]): void => cb(status)
      ipcRenderer.on(IPC.updates.status, listener)
      return () => ipcRenderer.removeListener(IPC.updates.status, listener)
    },
    install: () => ipcRenderer.invoke(IPC.updates.install)
  }
}

contextBridge.exposeInMainWorld('plex', api)
