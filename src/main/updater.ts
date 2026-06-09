import { app, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import { IPC } from '@shared/ipc'
import type { UpdateStatus } from '@shared/types'

// electron-updater is CommonJS; destructure the default export for ESM interop.
const { autoUpdater } = electronUpdater

/**
 * Wire electron-updater: on launch (packaged builds only) check the configured
 * publish feed, auto-download a newer build, and push progress to the renderer.
 * The renderer shows a banner and can trigger quitAndInstall().
 */
export function initAutoUpdate(win: BrowserWindow): void {
  // Only meaningful in a packaged app with an update feed (app-update.yml).
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const send = (status: UpdateStatus): void => {
    if (!win.isDestroyed()) win.webContents.send(IPC.updates.status, status)
  }

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => send({ state: 'none' }))
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => send({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (err) => {
    console.error('[updater]', err?.message ?? err)
    send({ state: 'error', message: err?.message ?? 'Update failed' })
  })

  autoUpdater.checkForUpdates().catch((err) => {
    // No feed configured / network down — non-fatal.
    console.warn('[updater] check skipped:', (err as Error).message)
  })
}

/** Quit and install a downloaded update. */
export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
