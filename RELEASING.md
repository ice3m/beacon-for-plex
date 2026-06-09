# Releasing Plex Desktop (auto-update via GitHub Releases)

Updates are delivered through **GitHub Releases** on
`https://github.com/ice3m/beacon-for-plex` (configured in `electron-builder.yml`
→ `publish`). Installed apps (v0.1.4+) check the latest release on launch and
show an in-app **Update → Restart** banner.

## One-time setup
1. Repo `ice3m/beacon-for-plex` must be **public** (private repos require an
   embedded token in the app — avoid).
2. Create a GitHub **Personal Access Token** (classic, scope `repo`; or a
   fine-grained token with **Contents: read & write** on this repo).
3. Make it available to electron-builder when releasing:
   - persistent: `setx GH_TOKEN "ghp_xxx"` then reopen the terminal, or
   - per session (PowerShell): `$env:GH_TOKEN = "ghp_xxx"`

## Cut a release
1. Bump `"version"` in `package.json` (must be **higher** than what's installed,
   e.g. `0.1.4` → `0.1.5`). The updater only offers strictly-newer versions.
2. `npm run release`
   - Builds the app and the NSIS installer, then uploads
     `Plex-Desktop-Setup-<version>.exe`, `latest.yml`, and `.blockmap` to a
     **draft** GitHub Release tagged `v<version>`.
3. Open the repo's **Releases** page and **Publish** the draft.
4. Done — running apps will detect it on next launch and offer to update.

## Bootstrapping (first time only)
The currently-installed build predates the updater, so install
`dist/Plex-Desktop-Setup-0.1.4.exe` **manually once**. Every build from 0.1.4
onward updates itself.

If you'd rather publish 0.1.4 without a token, you can create the `v0.1.4`
release on github.com by hand and upload the three files from `dist/`
(`Plex-Desktop-Setup-0.1.4.exe`, `latest.yml`, `Plex-Desktop-Setup-0.1.4.exe.blockmap`).
The artifact name is intentionally space-free so the uploaded asset matches the
name inside `latest.yml` (otherwise the updater 404s).

## Notes
- `npm run dist` builds locally **without** publishing (handy for testing).
- In dev (`npm run dev`) the updater is a no-op (`app.isPackaged` guard).
- Don't commit your `GH_TOKEN`.
