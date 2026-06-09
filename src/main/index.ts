import { app, BrowserWindow, Menu, nativeImage, shell, Tray } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc'
import { registerImageProtocol, registerImageScheme } from './plex/images'
import { hostname } from 'node:os'
import {
  getPlaybackPrefs,
  getWindowBounds,
  getWindowFlags,
  setWindowBounds,
  setWindowFlags
} from './store'
import { setPlayerWindow, shutdown as shutdownPlayer } from './player/playback'
import { startCompanion } from './companion/companion'
import { initAutoUpdate } from './updater'

/** Resolve the app icon, checking dev (project root) then packaged locations. */
function iconPath(): string | undefined {
  const candidates = [
    join(app.getAppPath(), 'resources', 'icon.png'),
    join(app.getAppPath(), 'Plex_favicon.png'),
    join(process.resourcesPath ?? '', 'icon.png')
  ]
  return candidates.find((p) => p && existsSync(p))
}

// Privileged scheme registration must happen before the app is ready.
registerImageScheme()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

/** Reveal + focus the main window (from the tray or a cast). */
function showMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/** Create the tray icon so the app can live in the system tray when closed. */
function createTray(): void {
  if (tray) return
  const icon = iconPath()
  let image = icon ? nativeImage.createFromPath(icon) : nativeImage.createEmpty()
  if (!image.isEmpty()) image = image.resize({ width: 16, height: 16 })
  tray = new Tray(image)
  tray.setToolTip('Plex Desktop')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Plex Desktop', click: showMainWindow },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
}

function createWindow(): void {
  const icon = iconPath()
  const saved = getWindowBounds()
  const win = new BrowserWindow({
    width: saved?.width ?? 1280,
    height: saved?.height ?? 800,
    ...(saved?.x != null && saved?.y != null ? { x: saved.x, y: saved.y } : {}),
    minWidth: 940,
    minHeight: 560,
    show: false,
    ...(icon ? { icon } : {}),
    backgroundColor: '#0b0b0b',
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      // electron-vite emits the preload as ESM (.mjs) under "type": "module".
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Restore maximized / fullscreen state from the last session before showing.
  const flags = getWindowFlags()
  win.on('ready-to-show', () => {
    if (flags.fullscreen) win.setFullScreen(true)
    else if (flags.maximized) win.maximize()
    win.show()
  })
  mainWindow = win
  setPlayerWindow(win)
  initAutoUpdate(win)

  // Minimize-to-tray: when enabled, the close (X) button hides to the tray
  // instead of quitting. A real quit (tray menu / before-quit) bypasses this.
  win.on('close', (e) => {
    if (!isQuitting && process.platform !== 'darwin' && getPlaybackPrefs().minimizeToTray) {
      e.preventDefault()
      win.hide()
    }
  })

  // Persist size/position (only when in a normal frame — not while maximized or
  // fullscreen) so un-maximizing restores the right size next launch. Debounced
  // so a drag-resize doesn't trigger a disk write per pixel.
  let boundsTimer: ReturnType<typeof setTimeout> | null = null
  const saveBounds = (): void => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => {
      if (!win.isDestroyed() && !win.isMinimized() && !win.isMaximized() && !win.isFullScreen()) {
        setWindowBounds(win.getBounds())
      }
    }, 400)
  }
  win.on('resize', saveBounds)
  win.on('moved', saveBounds)

  // Persist maximized / fullscreen transitions so they survive a restart.
  win.on('maximize', () => setWindowFlags({ maximized: true }))
  win.on('unmaximize', () => setWindowFlags({ maximized: false }))
  win.on('enter-full-screen', () => setWindowFlags({ fullscreen: true }))
  win.on('leave-full-screen', () => setWindowFlags({ fullscreen: false }))

  // Open target=_blank / external links in the system browser, not in-app —
  // but only safe web schemes (never file:/javascript:/etc.).
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const proto = new URL(url).protocol
      if (proto === 'http:' || proto === 'https:') void shell.openExternal(url)
    } catch {
      /* ignore malformed URLs */
    }
    return { action: 'deny' }
  })

  // electron-vite injects the dev server URL in development; load the built
  // file in production.
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerImageProtocol()
  registerIpcHandlers()
  createWindow()
  createTray()

  // Opt-in: advertise as a Plex player (cast target) on launch.
  if (getPlaybackPrefs().advertiseAsPlayer) {
    startCompanion(`Plex Desktop (${hostname()})`)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// A genuine quit must bypass minimize-to-tray; also kill the persistent mpv
// process so it doesn't orphan when the app exits.
app.on('before-quit', () => {
  isQuitting = true
  shutdownPlayer()
})
