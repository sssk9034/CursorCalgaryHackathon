# CLAUDE.md

## Project Overview

Electron desktop application built with Electron Forge, Vite, and TypeScript.

## Tech Stack

- **Runtime:** Electron 41
- **Bundler:** Vite 5 (via `@electron-forge/plugin-vite`)
- **Language:** TypeScript (~4.5)
- **Build/Package:** Electron Forge 7
- **Linting:** ESLint with `@typescript-eslint`

## Project Structure

```
src/
  main.ts        # Electron main process (creates BrowserWindow)
  preload.ts     # Preload script (runs before renderer, bridge to Node)
  renderer.ts    # Renderer process (browser context, imports index.css)
  index.css      # Global styles
index.html         # HTML entry point for the renderer
forge.config.ts    # Electron Forge configuration (makers, plugins, fuses)
vite.main.config.ts
vite.preload.config.ts
vite.renderer.config.ts
```

## Commands

```bash
npm start          # Start the app in development mode
npm run package    # Package the app for distribution
npm run make       # Build distributable installers
npm run lint       # Run ESLint across .ts/.tsx files
```

## Architecture Notes

- **Main process** (`src/main.ts`): Creates the BrowserWindow, handles app lifecycle events. Uses `electron-squirrel-startup` for Windows install/uninstall shortcuts.
- **Preload** (`src/preload.ts`): Bridge between main and renderer. Use `contextBridge` to safely expose APIs.
- **Renderer** (`src/renderer.ts`): Runs in the browser context. Node.js integration is disabled by default for security.
- Vite dev server URL is injected via `MAIN_WINDOW_VITE_DEV_SERVER_URL` global.
- Electron Fuses are configured for security (cookie encryption, no Node CLI inspect, ASAR integrity).

## Workflow

- **Always open a side branch before doing any work.** Do not commit directly to `main`. Create a descriptively named branch (e.g., `feature/add-settings`, `fix/window-resize`) before making changes.

## Conventions

- Use TypeScript for all source files
- Follow existing ESLint configuration
- Keep Node.js integration disabled in renderer for security
- Use the preload script + `contextBridge` for IPC between main and renderer
