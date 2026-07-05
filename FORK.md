# Unified Shell Fork — Maintainer Notes

This branch (`unified-shell`) rebuilds the app as a multi-instance shell;
user-facing documentation is in the ["Unified shell"](README.md#unified-shell--local-and-live-servers-together)
section of the README. It is a **clean, separate implementation** from the
`multi-instance` branch (tray-based switcher) — the two share no commits
beyond upstream.

## Design at a glance

One `BrowserWindow` hosts several `WebContentsView`s:

```
┌──────┬──────────────────────────────┐
│ rail │                              │
│ Live │   active instance's web app  │
│  ◉   │   (other instances' views    │
│ ──── │    stay attached, hidden,    │
│ Local│    and connected)            │
│  ◉   │                              │
│  +   │                              │
└──────┴──────────────────────────────┘
```

- The **rail** is our own tiny HTML page in a `WebContentsView` (72 px wide).
- Each **instance** gets its own `WebContentsView` running that instance's
  web app; switching toggles visibility only, so every instance stays
  connected and delivers notifications.
- Everything runs in the **main process + shell-owned views**; the Stoat
  web app's internals are never touched, so web app updates cannot break
  the shell. What the shell *cannot* do, by design, is merge data across
  instances (e.g. one combined friends list) — that would require forking
  the web client itself.

## Module map (fork-owned files — upstream merges can never conflict)

| File | Purpose |
| ---- | ------- |
| `src/native/instances.ts` | State only: instance list (`name`, `url`, `kind: live \| local`), active instance, kind inference for URLs (localhost/LAN ⇒ local). Depends on nothing else in the app. |
| `src/native/unifiedShell.ts` | The shell: rail view, per-instance views, layout, switching, per-view zoom/reload/spellcheck, right-click menu, rail IPC. |
| `src/native/instanceChooser.ts` | "Add a Server" popup: pick a Live/Local instance first, or jump to registering a new one. |
| `src/native/instanceDialog.ts` | "Register Instance" dialog (name, URL, Live/Local/Auto). |
| `src/native/instanceEditor.ts` | "Edit Instance" dialog: rename, colour (presets + picker), custom icon (native file dialog, resized to 128px and stored as a data URL in `instances.json`). |
| `src/world/unifiedShell.ts` | Preload bridge (`window.stoatShell`) for the rail, chooser, and dialog. All IPC channels are sender-checked in the main process, so instance web apps cannot invoke them. |

Adding a new shell feature should follow the same pattern: a new fork-owned
module, wired in through `unifiedShell.ts`, with at most a one-line hook in
an upstream file.

## Modified upstream files (keep these diffs minimal)

| File | Change |
| ---- | ------ |
| `src/native/window.ts` | `BUILD_URL` removed; `mainWindow.loadURL(...)` replaced by `initUnifiedShell(mainWindow)`; window always uses the native frame (views are told `customFrame: false`); the screen-share picker replies to the requesting view instead of the window's own (empty) contents. |
| `src/native/config.ts` | `sync()` split into `snapshot()` + `sync()` so each instance view can be sent the config. |
| `src/main.ts` | Navigation guard checks `isKnownInstanceUrl()` instead of a single build-time origin; auto-updater removed (an official release would replace the fork). |
| `src/preload.ts` | One import: `./world/unifiedShell`. |
| `src/world/config.ts` | Initial config is fetched synchronously (`config:getSync`, answered by `unifiedShell.ts`) so the web app never renders before knowing the frame style; instance views always receive `customFrame: false`. |
| `package.json` | Added `description` (the Squirrel maker requires it); version bumped per fork release. |

Untouched: `tray.ts` (Show/Hide/Quit as upstream), `badges.ts`,
`discordRpc.ts`, `autoLaunch.ts`, `world/window.ts`.

## Updating from upstream

```bash
git remote add upstream https://github.com/stoatchat/for-desktop  # once
git fetch upstream
git merge upstream/main
```

Conflicts, if any, are confined to the hooks in the table above. After
merging: `pnpm i`, `pnpm start` to smoke-test (switch instances in the rail,
add a server via +, register an instance, right-click → remove), then
`pnpm make --targets "@electron-forge/maker-squirrel"`.

## Build notes (Windows)

- Initialise the `assets` submodule before building:
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

- Data is not merged across instances (friends lists, DMs, search) — each
  instance's UI is complete but separate; the rail is the cross-instance
  navigation. Merging would require forking the Stoat web client.
- Notification badges from every instance draw on the same taskbar icon
  (upstream design); the count reflects whichever instance reported last.
- Memory scales with the number of registered instances, since all of them
  stay loaded.
- `instances.json` is shared with the `multi-instance` branch build; the
  `kind` field is added here and older entries are classified automatically,
  so switching between the two builds is safe.
