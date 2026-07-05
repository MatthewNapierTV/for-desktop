<div align="center">
  <h1>
    <a href="https://stt.gg/eq3mgQeY">💬 Join my Stoat</a>
  </h1>
  <h3>
    <a href="https://www.youtube.com/@matthewnapiertv">📺 MatthewNapierTV on YouTube</a>
  </h3>
</div>
<br/>

<div align="center">
<h1>
  Stoat for Desktop
  
  [![Stars](https://img.shields.io/github/stars/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/stargazers)
  [![Forks](https://img.shields.io/github/forks/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/network/members)
  [![Pull Requests](https://img.shields.io/github/issues-pr/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/pulls)
  [![Issues](https://img.shields.io/github/issues/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/issues)
  [![Contributors](https://img.shields.io/github/contributors/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/graphs/contributors)
  [![License](https://img.shields.io/github/license/stoatchat/for-desktop?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-desktop/blob/main/LICENSE)
</h1>
Application for Windows, macOS, and Linux.
</div>
<br/>

## Installation

<a href="https://repology.org/project/stoat-desktop/versions">
    <img src="https://repology.org/badge/vertical-allrepos/stoat-desktop.svg" alt="Packaging status" align="right">
</a>

- All downloads and instructions for Stoat can be found on our [Website](https://stoat.chat/download).

## Connecting to multiple instances

Upstream Stoat for Desktop is locked to the server it was built for — the
web app URL is baked in at build time, and the only escape hatch is the
`--force-server` command-line flag. This fork removes that limitation: the
server is chosen at runtime, and you can use a locally hosted instance and
the official one from the same app, even side by side.

> Stoat is not federated: each instance has its own accounts. Switching
> instances means logging in to each one separately. Logins are stored
> per-server, so sessions never interfere with each other.

### Using the instance switcher

Right-click the tray icon and open the **Instance** submenu:

| Menu item | What it does |
| --------- | ------------ |
| _An instance name_ | Switches the main window over to that instance. |
| **Open in New Window** | Opens an instance in an additional window, so you can be online on several instances at the same time. |
| **Add Instance…** | Registers a new server. Enter a display name and the URL of its web app — e.g. `http://localhost` for a local deployment, or `https://stoat.chat/app` — and the app connects right away. |
| **Remove Instance** | Deletes an entry from the list. The last remaining instance cannot be removed. |

### Behaviour details

- **Everything is remembered.** The instance list, the active instance, and
  any extra windows you had open are restored on the next launch. Closing an
  extra window yourself removes it from the next restore; quitting the app
  with it open brings it back.
- **The active-instance marker adapts.** With one instance open, the list
  shows a radio marker next to the instance in the main window. As soon as
  more than one instance is open at the same time, the marker is hidden —
  there is no longer a single "active" instance to point at.
- **`--force-server <url>` still works** and takes priority over the
  configured instances for the main window.
- **Auto-update is disabled** in this fork: an official release would replace
  the build and remove the instance switcher. To update instead, merge the
  latest upstream changes and rebuild — see [FORK.md](FORK.md).

### Where settings are stored

Instance configuration lives in `instances.json` inside the app's user-data
directory (`%APPDATA%\stoat-desktop` on Windows), next to the existing
`config.json`. Logins and other web app state are stored per-server by
Chromium and survive app updates and reinstalls.

### Troubleshooting

- **"Failed to enable push notifications. Please try again later."** —
  harmless, and not specific to this fork. The Stoat web app tries to
  register browser web push after a fresh login, which no Electron-based
  desktop shell supports (the official app included). Regular desktop
  notifications while the app is running are unaffected.
- **A server can't be added** — the URL must be the address of the
  instance's *web app* (the page you'd open in a browser), using `http://`
  or `https://`.

## Development Guide

_Contribution guidelines for Desktop app TBA!_

<!-- Before contributing, make yourself familiar with [our contribution guidelines](https://developers.revolt.chat/contrib.html), the [code style guidelines](./GUIDELINES.md), and the [technical documentation for this project](https://revoltchat.github.io/frontend/). -->

Before getting started, you'll want to install:

- Git
- Node.js
- pnpm (run `corepack enable`)

Then proceed to setup:

```bash
# clone the repository
git clone --recursive https://github.com/stoatchat/for-desktop stoat-for-desktop
cd stoat-for-desktop

# install all packages
pnpm i --frozen-lockfile

# start the application
pnpm start
# ... or build the bundle
pnpm package
# ... or build all distributables
pnpm make
```

Various useful commands for development testing:

```bash
# connect to the development server
pnpm start -- --force-server http://localhost:5173

# test the flatpak (after `make`)
pnpm install:flatpak
pnpm run:flatpak
# ... also connect to dev server like so:
pnpm run:flatpak --force-server http://localhost:5173

# Nix-specific instructions for testing
pnpm package
pnpm run:nix
# ... as before:
pnpm run:nix --force-server=http://localhost:5173
# a better solution would be telling
# Electron Forge where system Electron is
```

### Pulling in Stoat's assets

If you want to pull in Stoat brand assets after pulling, run the following:

```bash
# update the assets
git -c submodule."assets".update=checkout submodule update --init assets
```

Currently, this is required to build, any forks are expected to provide their own assets.
