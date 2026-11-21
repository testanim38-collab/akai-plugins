# Akai Plugins

Plugins for Valenced, the mobile Discord client mod.

## Install

Add this URL as a plugin repository in Valenced:

```
https://testanim38-collab.github.io/akai-plugins/index.json
```

Then open the repository in Valenced and install the plugins you want.

[Source Code](https://github.com/testanim38-collab/akai-plugins)

## Plugins

### Channel Preview

**Version:** 1.3.0

Floating channel previews: long-press a channel to open a draggable, resizable popup over your current channel. Minimize to side bubbles, run several at once.

### Passcode Lock

**Version:** 1.1.0

Add a local passcode screen for app startup, servers, channels, and DMs.

## Development

```
bun install
bun run build   # build every plugin
bun run pages   # build, pack zips and generate build/pages/index.json
```

`bun run pages` writes `build/pages/`. That folder is gitignored; GitHub Actions builds it and deploys it to GitHub Pages on every push to `main`.

## Bugs and Ideas

Found a bug or have an idea for a plugin? Open an issue on GitHub.
