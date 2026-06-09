import { ipcMain, shell } from 'electron'
import type { AuthStatus, SectionQuery } from '@shared/types'
import { IPC } from '@shared/ipc'
import { getCurrentAccount, logout, startLogin, waitForLogin } from './plex/auth'
import { listServers } from './plex/servers'
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  copyPlaylistToUser,
  getByActor,
  getChildren,
  getGenres,
  getHistory,
  pickRandom,
  getAllCollections,
  getCollectionItems,
  getCollections,
  getFilterValues,
  getHomeHubs,
  getMetadata,
  getOnDeck,
  getServerAccounts,
  getPlaylistItems,
  getPlaylists,
  getRecentlyAdded,
  getRelated,
  getSectionContents,
  getSectionHubs,
  getSectionMeta,
  getSections,
  markPlayed,
  markUnplayed,
  removePlaylistItem,
  search,
  updateProgress
} from './plex/client'
import { getServerPrefs, setServerPref } from './plex/prefs'
import { getUserToken, listHomeUsers } from './plex/users'
import {
  disableSync,
  enableSync,
  listSynced,
  startAutoSync,
  syncServer
} from './plex/playlistSync'
import { cancelPrewarm, getPrewarmStatus, startPrewarm } from './plex/prewarm'
import { clearCaches, getCacheSizes } from './plex/cacheAdmin'
import { hostname } from 'node:os'
import {
  addToWatchlist,
  getPlaybackPrefs,
  getWatchlist,
  removeFromWatchlist,
  setHomeUserToken,
  setPlaybackPrefs
} from './store'
import type { WatchlistEntry } from '@shared/types'
import * as player from './player/playback'
import { isRunning, startCompanion, stopCompanion } from './companion/companion'
import { installUpdate } from './updater'
import type { PlaybackPrefs } from '@shared/types'
import {
  getHiddenHistoryUsers,
  getSelectedServerId,
  setHistoryUserHidden,
  setLibraryHidden,
  setLibraryIcon,
  setLibraryOrder,
  setSelectedServerId
} from './store'

/** Wire every renderer-callable channel to its handler. */
export function registerIpcHandlers(): void {
  // --- Auth ---
  ipcMain.handle(IPC.auth.getStatus, async (): Promise<AuthStatus> => {
    const account = await getCurrentAccount()
    return account ? { state: 'logged-in', account } : { state: 'logged-out' }
  })
  ipcMain.handle(IPC.auth.startLogin, () => startLogin())
  ipcMain.handle(IPC.auth.waitForLogin, (_e, pinId: number) => waitForLogin(pinId))
  ipcMain.handle(IPC.auth.logout, () => {
    logout()
    setSelectedServerId(null)
  })

  // --- Servers ---
  ipcMain.handle(IPC.servers.list, () => listServers())
  ipcMain.handle(IPC.servers.getSelectedId, () => getSelectedServerId())
  ipcMain.handle(IPC.servers.setSelectedId, (_e, serverId: string | null) =>
    setSelectedServerId(serverId)
  )

  // --- Library ---
  ipcMain.handle(IPC.library.sections, (_e, serverId: string) => getSections(serverId))
  ipcMain.handle(
    IPC.library.sectionContents,
    (_e, serverId: string, sectionId: string, query?: SectionQuery) =>
      getSectionContents(serverId, sectionId, query)
  )
  ipcMain.handle(
    IPC.library.sectionMeta,
    (_e, serverId: string, sectionId: string, type: number) =>
      getSectionMeta(serverId, sectionId, type)
  )
  ipcMain.handle(IPC.library.filterValues, (_e, serverId: string, filterKey: string) =>
    getFilterValues(serverId, filterKey)
  )
  ipcMain.handle(IPC.library.search, (_e, serverId: string, query: string) =>
    search(serverId, query)
  )
  ipcMain.handle(IPC.library.homeHubs, (_e, serverId: string) => getHomeHubs(serverId))
  ipcMain.handle(IPC.library.onDeck, (_e, serverId: string) => getOnDeck(serverId))
  ipcMain.handle(
    IPC.library.recentlyAdded,
    (_e, serverId: string, sectionId: string, sectionType: string) =>
      getRecentlyAdded(serverId, sectionId, sectionType)
  )
  ipcMain.handle(IPC.library.sectionHubs, (_e, serverId: string, sectionId: string) =>
    getSectionHubs(serverId, sectionId)
  )
  ipcMain.handle(IPC.library.metadata, (_e, serverId: string, ratingKey: string) =>
    getMetadata(serverId, ratingKey)
  )
  ipcMain.handle(IPC.library.children, (_e, serverId: string, ratingKey: string) =>
    getChildren(serverId, ratingKey)
  )
  ipcMain.handle(IPC.library.related, (_e, serverId: string, ratingKey: string) =>
    getRelated(serverId, ratingKey)
  )
  ipcMain.handle(IPC.library.collections, (_e, serverId: string, sectionId: string) =>
    getCollections(serverId, sectionId)
  )
  ipcMain.handle(IPC.library.allCollections, (_e, serverId: string) =>
    getAllCollections(serverId)
  )
  ipcMain.handle(IPC.library.collectionItems, (_e, serverId: string, ratingKey: string) =>
    getCollectionItems(serverId, ratingKey)
  )
  ipcMain.handle(
    IPC.library.byActor,
    (_e, serverId: string, sectionId: string, actorId: string) =>
      getByActor(serverId, sectionId, actorId)
  )
  ipcMain.handle(IPC.library.genres, (_e, serverId: string, sectionIds?: string[]) =>
    getGenres(serverId, sectionIds)
  )
  ipcMain.handle(
    IPC.library.randomPick,
    (_e, serverId: string, opts: { sectionIds?: string[]; genre?: string }) =>
      pickRandom(serverId, opts)
  )
  ipcMain.handle(IPC.library.history, (_e, serverId: string, accountId?: number) =>
    getHistory(serverId, accountId)
  )
  ipcMain.handle(IPC.library.serverAccounts, (_e, serverId: string) => getServerAccounts(serverId))
  ipcMain.handle(IPC.library.getHiddenHistoryUsers, () => getHiddenHistoryUsers())
  ipcMain.handle(IPC.library.setHistoryUserHidden, (_e, accountId: number, hidden: boolean) =>
    setHistoryUserHidden(accountId, hidden)
  )
  ipcMain.handle(IPC.library.setLibraryOrder, (_e, orderedIds: string[]) =>
    setLibraryOrder(orderedIds)
  )
  ipcMain.handle(
    IPC.library.setLibraryIcon,
    (_e, sectionId: string, icon: string | null) => setLibraryIcon(sectionId, icon)
  )
  ipcMain.handle(
    IPC.library.setLibraryHidden,
    (_e, sectionId: string, hidden: boolean) => setLibraryHidden(sectionId, hidden)
  )
  ipcMain.handle(IPC.library.markPlayed, (_e, serverId: string, ratingKey: string) =>
    markPlayed(serverId, ratingKey)
  )
  ipcMain.handle(IPC.library.markUnplayed, (_e, serverId: string, ratingKey: string) =>
    markUnplayed(serverId, ratingKey)
  )
  ipcMain.handle(
    IPC.library.updateProgress,
    (
      _e,
      serverId: string,
      ratingKey: string,
      timeMs: number,
      state: 'playing' | 'paused' | 'stopped'
    ) => updateProgress(serverId, ratingKey, timeMs, state)
  )

  // --- Server settings ---
  ipcMain.handle(IPC.settings.getPrefs, (_e, serverId: string) => getServerPrefs(serverId))
  ipcMain.handle(IPC.settings.setPref, (_e, serverId: string, id: string, value: string) =>
    setServerPref(serverId, id, value)
  )
  ipcMain.handle(IPC.settings.getPlaybackPrefs, () => getPlaybackPrefs())
  ipcMain.handle(IPC.settings.setPlaybackPrefs, (_e, prefs: PlaybackPrefs) => {
    setPlaybackPrefs(prefs)
    // Start/stop the cast receiver to match the preference.
    if (prefs.advertiseAsPlayer && !isRunning()) startCompanion(`Plex Desktop (${hostname()})`)
    else if (!prefs.advertiseAsPlayer && isRunning()) stopCompanion()
  })

  // --- Playlists ---
  ipcMain.handle(IPC.playlists.list, (_e, serverId: string) => getPlaylists(serverId))
  ipcMain.handle(IPC.playlists.items, (_e, serverId: string, ratingKey: string) =>
    getPlaylistItems(serverId, ratingKey)
  )
  ipcMain.handle(
    IPC.playlists.create,
    (
      _e,
      serverId: string,
      title: string,
      type: 'audio' | 'video' | 'photo',
      itemRatingKeys: string[]
    ) => createPlaylist(serverId, title, type, itemRatingKeys)
  )
  ipcMain.handle(
    IPC.playlists.addItems,
    (_e, serverId: string, ratingKey: string, itemRatingKeys: string[]) =>
      addToPlaylist(serverId, ratingKey, itemRatingKeys)
  )
  ipcMain.handle(
    IPC.playlists.removeItem,
    (_e, serverId: string, ratingKey: string, playlistItemID: string) =>
      removePlaylistItem(serverId, ratingKey, playlistItemID)
  )
  ipcMain.handle(IPC.playlists.remove, (_e, serverId: string, ratingKey: string) =>
    deletePlaylist(serverId, ratingKey)
  )
  ipcMain.handle(
    IPC.playlists.shareToUser,
    async (
      _e,
      serverId: string,
      ratingKey: string,
      userUuid: string,
      pin?: string,
      keepInSync?: boolean
    ) => {
      try {
        const userToken = await getUserToken(userUuid, pin)
        const created = await copyPlaylistToUser(serverId, ratingKey, userToken)
        if (keepInSync) {
          // Cache the user's token so background sync runs without a PIN prompt.
          setHomeUserToken(userUuid, userToken)
          const users = await listHomeUsers().catch(() => [])
          const userTitle = users.find((u) => u.uuid === userUuid)?.title ?? 'User'
          enableSync({
            serverId,
            adminRatingKey: ratingKey,
            title: created.title,
            type: created.type,
            userUuid,
            userTitle,
            memberRatingKey: created.ratingKey,
            itemKeys: created.itemKeys
          })
        }
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Share failed' }
      }
    }
  )
  ipcMain.handle(IPC.playlists.listSynced, (_e, serverId: string) => listSynced(serverId))
  ipcMain.handle(IPC.playlists.syncNow, async (_e, serverId: string) => {
    try {
      await syncServer(serverId)
      return { ok: true, synced: listSynced(serverId) }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Sync failed',
        synced: listSynced(serverId)
      }
    }
  })
  ipcMain.handle(IPC.playlists.unsync, (_e, serverId: string, adminRatingKey: string) => {
    disableSync(serverId, adminRatingKey)
    return listSynced(serverId)
  })

  // --- Users ---
  ipcMain.handle(IPC.users.listHome, () => listHomeUsers())

  // --- Watchlist (client-side, persisted per server) ---
  ipcMain.handle(IPC.watchlist.list, (_e, serverId: string) => getWatchlist(serverId))
  ipcMain.handle(IPC.watchlist.add, (_e, serverId: string, entry: WatchlistEntry) =>
    addToWatchlist(serverId, entry)
  )
  ipcMain.handle(IPC.watchlist.remove, (_e, serverId: string, ratingKey: string) =>
    removeFromWatchlist(serverId, ratingKey)
  )

  // --- Full-database cache (artwork prewarm) ---
  ipcMain.handle(IPC.cache.start, (e, serverId: string) => {
    const wc = e.sender
    return startPrewarm(serverId, (s) => {
      if (!wc.isDestroyed()) wc.send(IPC.cache.status, s)
    })
  })
  ipcMain.handle(IPC.cache.cancel, () => cancelPrewarm())
  ipcMain.handle(IPC.cache.getStatus, () => getPrewarmStatus())
  ipcMain.handle(IPC.cache.size, () => getCacheSizes())
  ipcMain.handle(IPC.cache.clear, () => clearCaches())

  // Begin periodic two-way reconciliation of synced playlists.
  startAutoSync()

  // --- Playback ---
  ipcMain.handle(IPC.playback.start, (_e, serverId: string, ratingKey: string) =>
    player.start(serverId, ratingKey)
  )
  ipcMain.handle(IPC.playback.stop, () => player.stop())
  ipcMain.handle(IPC.playback.playPause, () => player.playPause())
  ipcMain.handle(IPC.playback.seekTo, (_e, ms: number) => player.seekTo(ms))
  ipcMain.handle(IPC.playback.seekBy, (_e, seconds: number) => player.seekBy(seconds))
  ipcMain.handle(IPC.playback.setVolume, (_e, volume: number) => player.setVolume(volume))
  ipcMain.handle(IPC.playback.next, () => player.next())
  ipcMain.handle(IPC.playback.prev, () => player.prev())
  ipcMain.handle(IPC.playback.minimize, () => player.minimize())
  ipcMain.handle(IPC.playback.expand, () => player.expand())
  ipcMain.handle(IPC.playback.setQuality, (_e, qualityId: string) => player.setQuality(qualityId))
  ipcMain.handle(IPC.playback.setSpeed, (_e, speed: number) => player.setSpeed(speed))
  ipcMain.handle(IPC.playback.setSubScale, (_e, scale: number) => player.setSubScale(scale))
  ipcMain.handle(IPC.playback.toggleFullscreen, () => player.toggleFullscreen())
  ipcMain.handle(IPC.playback.togglePip, () => player.togglePip())
  ipcMain.handle(IPC.playback.cancelUpNext, () => player.cancelUpNext())
  ipcMain.handle(IPC.playback.skip, () => player.skip())
  ipcMain.handle(IPC.updates.install, () => installUpdate())
  ipcMain.handle(IPC.playback.mediaInfo, () => player.getMediaInfo())
  ipcMain.handle(IPC.playback.audioTracks, () => player.audioTracks())
  ipcMain.handle(IPC.playback.subtitleOptions, () => player.subtitleOptions())
  ipcMain.handle(IPC.playback.selectAudio, (_e, id: number) => player.selectAudio(id))
  ipcMain.handle(IPC.playback.selectSubtitle, (_e, opt: import('@shared/types').SubtitleOption) =>
    player.selectSubtitle(opt)
  )
  ipcMain.handle(IPC.playback.searchSubtitles, () => player.searchSubtitles())
  ipcMain.handle(IPC.playback.downloadSubtitle, (_e, key: string) =>
    player.downloadSubtitleAndApply(key)
  )

  // --- System ---
  ipcMain.handle(IPC.system.openExternal, (_e, url: string) => shell.openExternal(url))
}
