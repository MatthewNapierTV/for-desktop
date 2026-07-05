# Multi-Instance Fork — Maintainer Notes

This fork adds runtime instance switching; the user-facing documentation is
in the ["Connecting to multiple instances"](README.md#connecting-to-multiple-instances)
section of the README. This file is the maintainer's map: what was changed,
where, and how to keep the fork current when upstream moves.

## Design at a glance

The feature lives entirely in the **main (Electron) process** and only
decides *which URL each window loads*. It never reaches into the Stoat web
app's internals, so web app releases require no changes here. All state is
kept in one electron-store file (`instances.json`): the instance list, the
active instance, and which extra windows to restore on launch.

## New files (fork-owned — upstream merges can never conflict here)

| File | Purpose |
| ---- | ------- |
| `src/native/instances.ts` | State only: persisted instance list, active instance, open-window list. Depends on nothing else in the app. |
| `src/native/instanceWindows.ts` | Window operations: switch the main window, open extra instance windows, restore them on launch, track how many are open. |
| `src/native/instanceMenu.ts` | Builds the whole "Instance" tray submenu as a single drop-in `MenuItemConstructorOptions` entry. Hides the active-instance radio marker while extra windows are open. |
| `src/native/instanceDialog.ts` | The "Add Instance" dialog window and its IPC handlers (sender-checked, so the remote web app cannot invoke them). |
| `src/world/instanceDialog.ts` | Preload bridge for the dialog (exposes `window.instanceDialog`). |

## Modified upstream files (keep these diffs minimal)

| File | Change |
| ---- | ------ |
| `src/native/window.ts` | `BUILD_URL` constant replaced by `getActiveInstanceUrl()` (still honours `--force-server`). `quitApp()` calls `app.quit()` instead of closing the main window, so extra instance windows close too. |
| `src/native/tray.ts` | One import; one `buildInstanceMenuItem()` entry in the menu template; a null-guard at the top of `updateTrayMenu()` (it can now be called before the tray exists or after it is destroyed). |
| `src/native/config.ts` | `sync()` split into `snapshot()` + `sync()`, so extra windows can be sent a config snapshot (`customFrame: false` — their native frame replaces the web app's window controls). |
| `src/main.ts` | Navigation guard checks `isKnownInstanceUrl()` instead of a single build-time origin. `restoreInstanceWindows()` is called on ready — **after `initTray()`**, because opening a window refreshes the tray menu. Auto-updater removed (an official release would replace the fork). |
| `src/preload.ts` | One import: `./world/instanceDialog`. |
| `package.json` | Added `description` (the Squirrel maker requires it). Version is bumped per fork release, independently of upstream. |

## Updating from upstream

```bash
git remote add upstream https://github.com/stoatchat/for-desktop  # once
git fetch upstream
git merge upstream/main
```

Conflicts, if any, are confined to the small hooks in the table above; the
fork-owned files merge untouched. After merging: `pnpm i`, `pnpm start` to
smoke-test (switch instances, open a second window, quit and relaunch), then
`pnpm make --targets "@electron-forge/maker-squirrel"` for the Windows
installer.

## Build notes (Windows)

- The `assets` git submodule must be initialised before building:
  `git -c submodule."assets".update=checkout submodule update --init assets`
- electron-forge shells out to `pnpm`, so `pnpm` must be on `PATH`.
- `tsc` does not run in this project (the pinned TypeScript cannot parse
  current `@types/node`); `pnpm lint` is the check that matters. The
  `import/no-unresolved` errors for `?asset` imports are a pre-existing
  lint/Vite mismatch and can be ignored.
- Do not edit `instances.json` with tools that write a UTF-8 BOM (e.g.
  PowerShell `Set-Content -Encoding utf8`) — electron-store's JSON parser
  rejects it.

## Known limitations

- Web push ("notify while the app is closed") is unsupported in any
  Electron shell; the web app shows a harmless snackbar about it after a
  fresh login. Regular desktop notifications work.
- Notification badges from every window are drawn on the main window's
  taskbar icon (upstream design); with several instances open, the badge
  reflects whichever instance reported last.
