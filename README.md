# Tab Focus

A browser extension + Electron app that detects tab thrashing and helps you focus by closing distracting tabs using AI.

## Architecture

```
browser-plugin/          # WXT browser extension (Chrome/Firefox)
  └─ background.ts       # Tracks tab switches, sends events to Electron
  └─ popup/              # Focus Mode UI button

electron-app/            # Electron desktop app
  └─ src/lib/db.ts       # SQLite storage for tab events
  └─ src/lib/event-server.ts   # HTTP server on localhost:3456
  └─ src/lib/thrash-detector.ts # Sliding window thrash detection
  └─ src/lib/focus-advisor.ts   # Gemini via OpenRouter for focus suggestions
```

## Prerequisites

- Node.js 18+
- npm
- An [OpenRouter](https://openrouter.ai/) API key

## Setup

1. Clone the repo and copy the env file:

```bash
cp .env.example .env
```

2. Add your OpenRouter API key to `.env`:

```
OPENROUTER_API_KEY=sk-or-your-key-here
```

3. Install dependencies in both projects:

```bash
cd electron-app && npm install
cd ../browser-plugin && npm install
```

## Running

You need both the Electron app and browser plugin running.

### 1. Start the Electron app

```bash
cd electron-app
npm start
```

This starts:
- The desktop window
- A local HTTP server on `http://127.0.0.1:3456`
- SQLite database at `~/Library/Application Support/my-app/tab-events.db`

### 2. Start the browser plugin

```bash
cd browser-plugin
npm run dev
```

This opens a Chrome instance with the extension loaded. The extension will:
- Track every tab switch and send events to the Electron app
- Detect thrashing (5+ switches across 3+ tabs in 30 seconds)
- Provide a **Focus Mode** button in the popup to clean up distracting tabs via AI

## Usage

- **Tab tracking**: Happens automatically in the background
- **Thrash detection**: Watch the Electron terminal for `THRASH DETECTED` alerts
- **Focus Mode**: Click the extension icon → "Activate Focus Mode" → review AI suggestions → close selected tabs
