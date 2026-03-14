# CLAUDE.md

## Project Overview

Monorepo containing two projects:
1. **Desktop App** (`desktop-app/`) — Electron desktop application
2. **Browser Extension** (`browser-extension/`) — Chrome extension (Manifest V3)

## Project Structure

```
desktop-app/                # Electron desktop application
  src/
    main.ts                 # Electron main process (creates BrowserWindow)
    preload.ts              # Preload script (bridge to Node)
    renderer.ts             # Renderer process (browser context)
    index.css               # Global styles
  index.html                # HTML entry point for the renderer
  forge.config.ts           # Electron Forge config
  package.json              # Desktop app dependencies
  tsconfig.json
  vite.*.config.ts          # Vite configs for main/preload/renderer

browser-extension/          # Chrome extension (Manifest V3)
  manifest.json             # Extension manifest
  src/
    content.js              # Content script — injected into web pages
    background.js           # Service worker — event-driven background tasks
```

## Tech Stack

### Desktop App
- **Runtime:** Electron 41
- **Bundler:** Vite 5 (via `@electron-forge/plugin-vite`)
- **Language:** TypeScript (~4.5)
- **Build/Package:** Electron Forge 7
- **Linting:** ESLint with `@typescript-eslint`

### Browser Extension
- **Platform:** Chrome Extensions (Manifest V3)
- **Language:** JavaScript (plain, no build step yet)

## Commands

### Desktop App
```bash
cd desktop-app
npm start          # Start the app in development mode
npm run package    # Package the app for distribution
npm run make       # Build distributable installers
npm run lint       # Run ESLint across .ts/.tsx files
```

### Browser Extension
Load `browser-extension/` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

## Architecture Notes

### Desktop App
- **Main process** (`src/main.ts`): Creates the BrowserWindow, handles app lifecycle events. Uses `electron-squirrel-startup` for Windows install/uninstall shortcuts.
- **Preload** (`src/preload.ts`): Bridge between main and renderer. Use `contextBridge` to safely expose APIs.
- **Renderer** (`src/renderer.ts`): Runs in the browser context. Node.js integration is disabled by default for security.
- Vite dev server URL is injected via `MAIN_WINDOW_VITE_DEV_SERVER_URL` global.
- Electron Fuses are configured for security (cookie encryption, no Node CLI inspect, ASAR integrity).

### Browser Extension
- **Content script** (`src/content.js`): Injected into web pages matched by `manifest.json`. Runs in the page's context with access to the DOM but isolated JS environment.
- **Service worker** (`src/background.js`): Event-driven background script. No persistent state — use `chrome.storage` for persistence. Handles extension lifecycle events and cross-tab coordination.

## Workflow

- **Always open a side branch before doing any work.** Do not commit directly to `main`. Create a descriptively named branch (e.g., `feature/add-settings`, `fix/window-resize`) before making changes.

## Conventions

- Use TypeScript for all desktop app source files
- Follow existing ESLint configuration in `desktop-app/`
- Keep Node.js integration disabled in Electron renderer for security
- Use the preload script + `contextBridge` for IPC between main and renderer
- Browser extension uses Manifest V3 patterns (service workers, not background pages)
