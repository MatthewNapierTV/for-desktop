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

## Unified shell — local and live servers together

This branch turns the app into a unified shell: instead of being locked to
one Stoat server, every instance you register (the official live one, your
locally hosted ones, anyone else's) lives in a single window, **all
connected at the same time**.

> Stoat is not federated: each instance has its own accounts, so you log in
> to each one separately. Logins are stored per-server and never interfere.

### The instance rail

A slim rail on the left edge of the window lists your instances, grouped
under **Live** and **Local** headings with a separator between them —
this is the "server separator" for backends. Each entry shows the
instance's initials, colour-coded (blue ring = live, green ring = local).

- **Click** an instance to bring it into view. The others keep running in
  the background, so notifications from every instance arrive in real time.
- **Right-click** an instance for **Edit Instance…**, **Reload** and
  **Remove Instance**.
- **Edit Instance…** lets you rename an instance, give it a colour (presets
  or a full colour picker), and set a custom icon from an image file —
  just like decorating a Stoat server. Icons are scaled down and stored in
  your instance configuration.
- The highlighted (orange) entry is the one currently shown.
- The **chevron at the bottom** of the rail collapses it to a thin strip
  (and back); the choice is remembered across restarts.
- The green **+** sits directly under the last instance in the list.

### Adding things

Clicking the green **+** at the bottom of the rail opens **"Add a Server"**,
which first asks *where* the server should go:

1. Pick an instance from the **Live** / **Local** groups (local entries are
   numbered — local 1, local 2, … — when you have several), and you're
   taken there to use that instance's own **+** button to create or join
   the chat server.
2. Or choose **"Register a new instance (a literal server)"** to add a
   whole new backend: display name, web app URL, and whether it's Live or
   Local (auto-detected from the URL by default — localhost and LAN
   addresses count as Local).

### Notes

- Instance configuration lives in `instances.json` under the app's
  user-data directory (`%APPDATA%\stoat-desktop` on Windows).
- `--force-server <url>` still works: the forced server shows up in the
  rail as an extra entry for that session.
- Auto-update is disabled on this branch so official releases don't replace
  the shell. See [FORK.md](FORK.md) for the upstream-merge workflow.
- Every instance stays loaded, so memory use grows with the number of
  registered instances.

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
