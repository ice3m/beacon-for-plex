// Types shared across the main, preload, and renderer processes.

/** Where we are in the plex.tv PIN-based OAuth flow. */
export interface PinSession {
  id: number
  code: string
  /** Fully-formed URL the user opens to authorize this client. */
  authUrl: string
}

export interface PlexAccount {
  id: number
  uuid: string
  username: string
  title: string
  email: string
  thumb: string | null
}

/** A single reachable address for a server (local, remote, or relay). */
export interface PlexConnection {
  uri: string
  address: string
  port: number
  protocol: string
  local: boolean
  relay: boolean
}

/** A Plex Media Server the account has access to. */
export interface PlexServer {
  name: string
  /** machineIdentifier — stable unique id for the server. */
  clientIdentifier: string
  product: string
  productVersion: string
  owned: boolean
  /** Per-server access token. */
  accessToken: string
  connections: PlexConnection[]
  /** The connection we successfully reached during discovery, if any. */
  bestConnection: PlexConnection | null
}

/** A Plex Home (managed) user the admin can act on behalf of. */
export interface PlexHomeUser {
  id: number
  uuid: string
  title: string
  thumb: string | null
  admin: boolean
  restricted: boolean
  /** True if switching to this user requires a PIN. */
  protected: boolean
}

/** An account known to the Plex Media Server (owner + shared users) — used to
 * filter watch history by who watched. */
export interface PlexServerAccount {
  id: number
  name: string
  thumb: string | null
}

/** One Home user's copy within a two-way-synced playlist group. */
export interface SyncedPlaylistMember {
  userUuid: string
  userTitle: string
  /** ratingKey of this user's copy of the playlist. */
  ratingKey: string
  /** True when the cached user token expired — re-share to fix. */
  needsAuth?: boolean
}

/** A playlist kept in two-way sync between the admin and Home users. */
export interface SyncedPlaylist {
  serverId: string
  /** ratingKey of the admin's (source) playlist. */
  adminRatingKey: string
  title: string
  type: string
  /** Item count at the last successful reconcile (the shared baseline). */
  itemCount: number
  members: SyncedPlaylistMember[]
  updatedAt: number
  lastSyncedAt?: number
  lastError?: string
}

/** Progress of a full-database artwork prewarm. */
export interface CacheProgress {
  running: boolean
  /** Human-readable current step (e.g. "Scanning Movies…", "Caching artwork…"). */
  phase: string
  /** Images processed so far in the cache phase. */
  done: number
  /** Total images to process (known once scanning completes). */
  total: number
  /** Freshly downloaded this run. */
  cached: number
  /** Already on disk (skipped). */
  skipped: number
  errors: number
  /** Library currently being scanned, when applicable. */
  currentLibrary?: string
}

/** A lightweight snapshot of an item saved to the personal Watchlist. */
export interface WatchlistEntry {
  ratingKey: string
  key: string
  type: string
  title: string
  thumb?: string
  parentThumb?: string
  grandparentThumb?: string
  year?: number
  /** When it was added (ms epoch) — list is newest-first. */
  addedAt: number
}

export type AuthStatus =
  | { state: 'logged-out' }
  | { state: 'logged-in'; account: PlexAccount }

/** A library section (Movies, TV Shows, Music, Photos, …). */
export interface PlexLibrarySection {
  key: string
  title: string
  type: string
  agent: string
  scanner: string
  language: string
  uuid: string
  updatedAt: number
  /** Local, client-side custom icon override (emoji or named glyph). */
  customIcon: string | null
  /** Local, client-side flag to hide this library from the sidebar. */
  hidden: boolean
}

/** One playable version of an item (codec/resolution/size). */
export interface PlexMediaVersion {
  videoResolution?: string
  videoCodec?: string
  audioCodec?: string
  audioChannels?: number
  container?: string
  bitrate?: number
  width?: number
  height?: number
  /** File size in bytes (from the first part). */
  size?: number
}

/** A cast member or crew credit. */
export interface PlexRole {
  id: string
  tag: string // person's name
  role?: string // character / job
  thumb?: string // headshot (server path or absolute URL)
}

/**
 * A generic Plex metadata item. Plex reuses one rich shape across movies,
 * shows, seasons, episodes, artists, albums, tracks, and clips — fields are
 * optional because which ones are present depends on `type`.
 */
export interface PlexMediaItem {
  ratingKey: string
  key: string
  type: string
  title: string
  titleSort?: string
  summary?: string
  year?: number
  /** Server-relative artwork paths; resolve via imageUrl(). */
  thumb?: string
  art?: string
  parentThumb?: string
  grandparentThumb?: string
  duration?: number
  addedAt?: number
  updatedAt?: number
  lastViewedAt?: number
  viewCount?: number
  /** Resume position in ms (presence implies "in progress"). */
  viewOffset?: number
  index?: number
  parentIndex?: number
  parentTitle?: string
  grandparentTitle?: string
  parentRatingKey?: string
  grandparentRatingKey?: string
  childCount?: number
  leafCount?: number
  viewedLeafCount?: number
  contentRating?: string
  rating?: number
  /** Section this item belongs to, when known. */
  librarySectionID?: string
  /** Present only on items returned as part of a playlist; needed to remove. */
  playlistItemID?: string
  /** Intro/credit markers (only when fetched with includeMarkers). */
  markers?: PlexMarker[]
  /** Optional UI badge, e.g. "New: S2 · E5" on a show with a fresh episode. */
  badge?: string
  /** Cast (only on full metadata fetches). */
  roles?: PlexRole[]
  directors?: string[]
  writers?: string[]
  studio?: string
  tagline?: string
  originallyAvailableAt?: string
  audienceRating?: number
  genres?: string[]
  collections?: string[]
  media?: PlexMediaVersion[]
}

/** An intro/credit/commercial marker for skip-intro / skip-credits. */
export interface PlexMarker {
  type: string // 'intro' | 'credits' | 'commercial'
  startTimeOffset: number
  endTimeOffset: number
  final?: boolean
}

/** A single server preference (from /:/prefs), e.g. a transcoder setting. */
export interface ServerSetting {
  id: string
  label: string
  summary: string
  type: string // 'bool' | 'int' | 'text' | 'double'
  group: string
  value: string
  default: string
  advanced: boolean
  hidden: boolean
  /** Parsed from Plex's "v:Label|v:Label" enum string, when present. */
  enumValues?: { value: string; label: string }[]
}

/** A homescreen / section hub (a titled row of items). */
export interface PlexHub {
  hubIdentifier: string
  title: string
  type: string
  /** Deep-link key to view the whole hub, when present. */
  more?: string
  items: PlexMediaItem[]
}

export interface PlexPlaylist {
  ratingKey: string
  key: string
  title: string
  summary?: string
  smart: boolean
  playlistType: string
  /** Number of items. */
  leafCount?: number
  duration?: number
  thumb?: string
  composite?: string
  addedAt?: number
  updatedAt?: number
}

/** Options for paging/sorting/filtering a library grid. */
export interface SectionQuery {
  sort?: string
  start?: number
  size?: number
  /** Filter by item type within a section, e.g. show vs. episode. */
  type?: number
  /** Active filters as Plex query params (e.g. {key:'genre', value:'123'}). */
  filters?: { key: string; value: string }[]
}

/** A sort option offered by the server for a section. */
export interface SectionSort {
  key: string
  title: string
  defaultDirection: 'asc' | 'desc'
}

/** A filter offered by the server for a section. */
export interface SectionFilter {
  /** Query-param name, e.g. 'genre', 'year', 'unwatched'. */
  filter: string
  title: string
  filterType: string // 'string' | 'integer' | 'boolean'
  /** Path to fetch this filter's selectable values. */
  key: string
}

export interface FilterValue {
  key: string
  title: string
}

export interface SectionMeta {
  sorts: SectionSort[]
  filters: SectionFilter[]
}

export interface SectionPage {
  items: PlexMediaItem[]
  totalSize: number
  offset: number
}

/** Playback preferences (audio/subtitle language, surround, auto behaviors). */
export interface PlaybackPrefs {
  audioLang: string
  subtitleLang: string
  subtitlesOn: boolean
  surround: boolean
  /** Auto-skip the intro marker when reached. */
  autoSkipIntro: boolean
  /** Always skip the credits marker when reached. */
  autoSkipCredits: boolean
  /** Automatically play the next episode when one finishes. */
  autoPlayNext: boolean
  /** Advertise this app as a Plex player (cast target) on the network. */
  advertiseAsPlayer: boolean
  /** Default streaming quality preset id (e.g. 'original'). */
  defaultQuality: string
  /** Hide to the system tray (instead of quitting) when the window is closed. */
  minimizeToTray: boolean
}

/** An audio/subtitle/video track exposed by mpv during playback. */
export interface MediaTrack {
  id: number
  type: 'audio' | 'sub' | 'video'
  selected: boolean
  lang?: string
  title?: string
  codec?: string
  channels?: number
}

/** Live technical info about the currently-playing stream (read from mpv). */
export interface MediaInfo {
  /** "Direct Play" or "Transcode". */
  playbackMethod: string
  /** Selected quality preset label. */
  quality?: string
  /** e.g. "1920×1080". */
  resolution?: string
  videoCodec?: string
  videoBitrateKbps?: number
  fps?: number
  audioCodec?: string
  audioChannels?: string
  audioBitrateKbps?: number
  container?: string
  /** Hardware decoder in use, or "Software". */
  hwDecode?: string
}

/** A subtitle found via on-demand (OpenSubtitles) search. */
export interface SubtitleSearchResult {
  key: string
  title: string
  lang?: string
  score?: number
}

/** A selectable subtitle: Off, an embedded mpv track, or an external (Plex) sub. */
export interface SubtitleOption {
  /** Stable key for UI selection. */
  key: string
  label: string
  kind: 'off' | 'embedded' | 'external'
  /** mpv sub id for embedded tracks. */
  id?: number
  /** Stream URL for external subs (loaded via mpv sub-add). */
  url?: string
  selected: boolean
}

/** Live playback status pushed from the main process to the renderer. */
export interface PlaybackStatus {
  active: boolean
  ratingKey?: string
  title?: string
  timeMs?: number
  durationMs?: number
  paused?: boolean
  /** Current volume 0–130 (100 = original). */
  volume?: number
  /** A pending skip opportunity (intro/credits) the user can act on. */
  skip?: { kind: string; untilMs: number } | null
  /** Whether a next episode is queued (enables the Next button). */
  hasNext?: boolean
  hasPrev?: boolean
  /** Video window hidden (playing in the mini-bar). */
  minimized?: boolean
  /** Active quality preset id. */
  quality?: string
  /** Playback speed multiplier (1 = normal). */
  speed?: number
  /** Subtitle scale (1 = normal). */
  subScale?: number
  /** Whether the video is fullscreen. */
  fullscreen?: boolean
  /** Whether the video is in floating picture-in-picture mode. */
  pip?: boolean
  /** True once mpv has rendered its first frame (used to hide the load screen). */
  loaded?: boolean
  /** When near the end with a next episode queued: the Up Next prompt. */
  upNext?: { label: string } | null
  /** Set when playback failed to start or errored. */
  error?: string
}

/** The typed surface exposed to the renderer via the preload bridge. */
export interface PlexApi {
  auth: {
    getStatus: () => Promise<AuthStatus>
    startLogin: () => Promise<PinSession>
    waitForLogin: (pinId: number) => Promise<PlexAccount>
    logout: () => Promise<void>
  }
  servers: {
    list: () => Promise<PlexServer[]>
    getSelectedId: () => Promise<string | null>
    setSelectedId: (serverId: string | null) => Promise<void>
  }
  library: {
    sections: (serverId: string) => Promise<PlexLibrarySection[]>
    sectionContents: (
      serverId: string,
      sectionId: string,
      query?: SectionQuery
    ) => Promise<SectionPage>
    /** Server-provided sort + filter options for a section. */
    sectionMeta: (
      serverId: string,
      sectionId: string,
      type: number
    ) => Promise<SectionMeta>
    /** Selectable values for a filter (e.g. the genre list). */
    filterValues: (serverId: string, filterKey: string) => Promise<FilterValue[]>
    /** Global search across libraries, grouped into hubs. */
    search: (serverId: string, query: string) => Promise<PlexHub[]>
    /** Home hubs (Continue Watching, Recently Added, …). */
    homeHubs: (serverId: string) => Promise<PlexHub[]>
    /** In-progress + next-up items across libraries (Continue Watching). */
    onDeck: (serverId: string) => Promise<PlexMediaItem[]>
    /**
     * Recently added for a section. For TV libraries this collapses to the
     * shows that gained new episodes ("Last Episode Added"), not just brand-new
     * shows.
     */
    recentlyAdded: (
      serverId: string,
      sectionId: string,
      sectionType: string
    ) => Promise<PlexMediaItem[]>
    /** Per-section hubs (Recently Added, By Genre, …). */
    sectionHubs: (serverId: string, sectionId: string) => Promise<PlexHub[]>
    metadata: (serverId: string, ratingKey: string) => Promise<PlexMediaItem | null>
    children: (serverId: string, ratingKey: string) => Promise<PlexMediaItem[]>
    /** "More Like This" / related hubs for an item. */
    related: (serverId: string, ratingKey: string) => Promise<PlexHub[]>
    /** Collections in a library section. */
    collections: (serverId: string, sectionId: string) => Promise<PlexMediaItem[]>
    /** All collections across the server's visible libraries. */
    allCollections: (serverId: string) => Promise<PlexMediaItem[]>
    /** Items inside a collection. */
    collectionItems: (serverId: string, ratingKey: string) => Promise<PlexMediaItem[]>
    /** A person's appearances in a section (filmography). */
    byActor: (serverId: string, sectionId: string, actorId: string) => Promise<PlexMediaItem[]>
    /** Distinct genre titles across the given (or all video) libraries. */
    genres: (serverId: string, sectionIds?: string[]) => Promise<string[]>
    /** Pick one random item across libraries, honoring an optional genre. */
    randomPick: (
      serverId: string,
      opts: { sectionIds?: string[]; genre?: string }
    ) => Promise<PlexMediaItem | null>
    /** Recently watched items (play history), newest first. Optionally filtered
     * to a single server account (user). */
    history: (serverId: string, accountId?: number) => Promise<PlexMediaItem[]>
    /** Accounts known to the server (owner + shared users), to filter history. */
    serverAccounts: (serverId: string) => Promise<PlexServerAccount[]>
    /** Server account ids hidden from the Recently Watched user dropdown. */
    getHiddenHistoryUsers: () => Promise<number[]>
    setHistoryUserHidden: (accountId: number, hidden: boolean) => Promise<void>
    setLibraryOrder: (orderedIds: string[]) => Promise<void>
    setLibraryIcon: (sectionId: string, icon: string | null) => Promise<void>
    setLibraryHidden: (sectionId: string, hidden: boolean) => Promise<void>
    /** Mark an item (and its children) as fully watched. */
    markPlayed: (serverId: string, ratingKey: string) => Promise<void>
    /** Clear watched state for an item. */
    markUnplayed: (serverId: string, ratingKey: string) => Promise<void>
    /** Report playback progress (used during playback in Phase 3). */
    updateProgress: (
      serverId: string,
      ratingKey: string,
      timeMs: number,
      state: 'playing' | 'paused' | 'stopped'
    ) => Promise<void>
  }
  settings: {
    /** Read the server's preferences (requires owning the server). */
    getPrefs: (serverId: string) => Promise<ServerSetting[]>
    setPref: (serverId: string, id: string, value: string) => Promise<void>
    getPlaybackPrefs: () => Promise<PlaybackPrefs>
    setPlaybackPrefs: (prefs: PlaybackPrefs) => Promise<void>
  }
  playlists: {
    list: (serverId: string) => Promise<PlexPlaylist[]>
    items: (serverId: string, ratingKey: string) => Promise<PlexMediaItem[]>
    create: (
      serverId: string,
      title: string,
      type: 'audio' | 'video' | 'photo',
      itemRatingKeys: string[]
    ) => Promise<PlexPlaylist | null>
    addItems: (serverId: string, ratingKey: string, itemRatingKeys: string[]) => Promise<void>
    removeItem: (serverId: string, ratingKey: string, playlistItemID: string) => Promise<void>
    remove: (serverId: string, ratingKey: string) => Promise<void>
    /**
     * Copy a playlist into a Home user's account (only they will see it). With
     * keepInSync, the copy is registered for ongoing two-way sync.
     */
    shareToUser: (
      serverId: string,
      ratingKey: string,
      userUuid: string,
      pin?: string,
      keepInSync?: boolean
    ) => Promise<{ ok: boolean; error?: string }>
    /** List playlists currently kept in two-way sync on this server. */
    listSynced: (serverId: string) => Promise<SyncedPlaylist[]>
    /** Force a reconcile of all synced playlists on this server. */
    syncNow: (serverId: string) => Promise<{ ok: boolean; error?: string; synced: SyncedPlaylist[] }>
    /** Stop syncing a playlist group (leaves existing copies in place). */
    unsync: (serverId: string, adminRatingKey: string) => Promise<SyncedPlaylist[]>
  }
  users: {
    /** List the account's Plex Home (managed) users. */
    listHome: () => Promise<PlexHomeUser[]>
  }
  watchlist: {
    list: (serverId: string) => Promise<WatchlistEntry[]>
    add: (serverId: string, entry: WatchlistEntry) => Promise<WatchlistEntry[]>
    remove: (serverId: string, ratingKey: string) => Promise<WatchlistEntry[]>
  }
  playback: {
    /**
     * Start playing an item. By default resumes from its saved offset; pass
     * `{ startMs: 0 }` to watch from the beginning.
     */
    start: (
      serverId: string,
      ratingKey: string,
      opts?: { startMs?: number; quality?: string }
    ) => Promise<{ ok: boolean; error?: string }>
    stop: () => Promise<void>
    playPause: () => Promise<void>
    /** Seek to an absolute position in milliseconds. */
    seekTo: (ms: number) => Promise<void>
    /** Seek relative by +/- seconds. */
    seekBy: (seconds: number) => Promise<void>
    setVolume: (volume: number) => Promise<void>
    /** Skip to the next episode (when one is queued). */
    next: () => Promise<void>
    /** Go to the previous episode. */
    prev: () => Promise<void>
    /** Minimize video to the mini-bar (keeps playing). */
    minimize: () => Promise<void>
    /** Restore the fullscreen video. */
    expand: () => Promise<void>
    /** Switch streaming quality (restarts at current position). */
    setQuality: (qualityId: string) => Promise<void>
    /** Set playback speed multiplier (e.g. 0.5–2). */
    setSpeed: (speed: number) => Promise<void>
    /** Set subtitle scale (e.g. 0.7–1.6). */
    setSubScale: (scale: number) => Promise<void>
    /** Toggle fullscreen video. */
    toggleFullscreen: () => Promise<void>
    /** Toggle floating picture-in-picture mode. */
    togglePip: () => Promise<void>
    /** Dismiss the Up Next prompt (and cancel auto-advance for this item). */
    cancelUpNext: () => Promise<void>
    /** Act on the current skip prompt (skip intro/credits). */
    skip: () => Promise<void>
    /** Live technical info about the current stream (resolution, codecs, bitrate). */
    mediaInfo: () => Promise<MediaInfo | null>
    /** Audio tracks (embedded in the file). */
    audioTracks: () => Promise<MediaTrack[]>
    /** Subtitle options: Off + embedded tracks + external (Plex) subs. */
    subtitleOptions: () => Promise<SubtitleOption[]>
    selectAudio: (id: number) => Promise<void>
    selectSubtitle: (opt: SubtitleOption) => Promise<void>
    /** Search OpenSubtitles for the current item (preferred language). */
    searchSubtitles: () => Promise<SubtitleSearchResult[]>
    /** Download + apply a searched subtitle by its key. */
    downloadSubtitle: (key: string) => Promise<void>
    /** Subscribe to live playback status; returns an unsubscribe fn. */
    onStatus: (cb: (status: PlaybackStatus) => void) => () => void
  }
  cache: {
    /** Start a full-database artwork prewarm. */
    start: (serverId: string) => Promise<CacheProgress>
    /** Request cancellation of an in-progress prewarm. */
    cancel: () => Promise<CacheProgress>
    /** Current prewarm status (for restoring UI on mount). */
    getStatus: () => Promise<CacheProgress>
    /** Bytes used by the on-disk artwork + metadata caches. */
    size: () => Promise<{ images: number; metadata: number }>
    /** Delete all cached artwork + metadata; returns the freed sizes. */
    clear: () => Promise<{ images: number; metadata: number }>
    /** Subscribe to live prewarm progress; returns an unsubscribe fn. */
    onStatus: (cb: (status: CacheProgress) => void) => () => void
  }
  system: {
    openExternal: (url: string) => Promise<void>
  }
  updates: {
    /** Subscribe to auto-update progress; returns an unsubscribe fn. */
    onStatus: (cb: (status: UpdateStatus) => void) => () => void
    /** Quit and install a downloaded update. */
    install: () => Promise<void>
    /**
     * Itemized "What's New" notes for this launch when it's a fresh upgrade
     * to a version that has notes; null otherwise (and only ever returns
     * non-null once per upgrade).
     */
    whatsNew: () => Promise<{ version: string; items: string[] } | null>
  }
}

/** Auto-update lifecycle state pushed from main to the renderer. */
export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'none' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }
